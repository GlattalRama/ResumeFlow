import { NextResponse } from "next/server";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { extractResumeFromText, htmlToInlineFormattedText } from "@/lib/aiImport";
import { emptyResumeData, normalizeResumeData } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file — resumes are small; reject blobs early.
const MAX_FILES = 5; // cap how many documents one import can merge.

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tidyInlineText(s: string): string {
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const BOLD_FONT_RE = /bold|black|heavy|semibold|demibold|demi/i;
const ITALIC_FONT_RE = /italic|oblique/i;

// EXPERIMENTAL best-effort: pull text from a PDF and infer bold/italic per text
// run from its font. PDFs don't carry real style runs — emphasis is implied by
// the embedded font's name/flags (e.g. "...-BoldMT") — so this is a heuristic:
// reliable-ish for bold/italic, and underline is not recoverable (it's drawn as
// a separate line, not a text attribute). Returns inline <strong>/<em> tagged
// text. The caller falls back to plain extraction if this throws or yields little.
async function extractPdfFormatted(
  buffer: Buffer
): Promise<{ text: string; formatted: boolean }> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));

  let out = "";
  let boldChars = 0;
  let totalChars = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    // Parse the content stream first so the embedded fonts get registered in
    // commonObjs — getTextContent alone doesn't load them, and without the
    // resolved font name (e.g. "Arial,Bold") there's no bold/italic signal.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page as any).getOperatorList().catch(() => {});
    const content = await page.getTextContent();
    const styles: Record<string, { fontFamily?: string }> =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (content as any).styles ?? {};

    const styleOf = (fontName: string): { bold: boolean; italic: boolean } => {
      // Prefer the resolved font object (has reliable .bold/.italic flags and a
      // PostScript .name); fall back to the CSS fontFamily from getTextContent.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const co: any = (page as any).commonObjs;
        if (co?.has?.(fontName)) {
          const f = co.get(fontName);
          const nm = String(f?.name ?? "");
          return {
            bold: f?.bold === true || BOLD_FONT_RE.test(nm),
            italic: f?.italic === true || ITALIC_FONT_RE.test(nm),
          };
        }
      } catch {
        /* fall through to fontFamily */
      }
      const fam = String(styles[fontName]?.fontFamily ?? "");
      return { bold: BOLD_FONT_RE.test(fam), italic: ITALIC_FONT_RE.test(fam) };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let prev: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of content.items as any[]) {
      if (typeof it.str !== "string") continue;
      const s: string = it.str;
      if (s.length === 0) {
        if (it.hasEOL) {
          out += "\n";
          prev = null;
        }
        continue;
      }
      // Insert a space when two runs on the same line are visually separated
      // but neither supplies the whitespace (common in PDF text streams).
      if (prev) {
        const prevEndX = prev.transform[4] + (prev.width || 0);
        const gap = it.transform[4] - prevEndX;
        const approx =
          prev.width && prev.str.length ? prev.width / prev.str.length : 1.5;
        if (!/\s$/.test(prev.str) && !/^\s/.test(s) && gap > approx * 0.3) {
          out += " ";
        }
      }
      const { bold, italic } = styleOf(it.fontName);
      let chunk = escHtml(s);
      if (italic) chunk = `<em>${chunk}</em>`;
      if (bold) chunk = `<strong>${chunk}</strong>`;
      out += chunk;
      totalChars += s.length;
      if (bold) boldChars += s.length;
      if (it.hasEOL) {
        out += "\n";
        prev = null;
      } else {
        prev = it;
      }
    }
    out += "\n";
  }

  // Guard against a resume whose body font merely has a "bold" name: if most of
  // the text came out bold, the signal is noise — drop bold entirely.
  if (totalChars > 0 && boldChars / totalChars > 0.6) {
    out = out.replace(/<\/?strong>/g, "");
  }
  out = tidyInlineText(out);
  return { text: out, formatted: /<(?:strong|em)>/.test(out) };
}

// Pull text out of an uploaded resume file. PDF via unpdf, .docx via mammoth.
// Both .docx and PDF attempt to keep inline bold/italic(/underline for .docx)
// so the import can preserve formatting in the rich-text fields; `formatted`
// tells the parser the text carries those tags. PDF style detection is a
// heuristic and falls back to plain text. Both libs are dynamically imported so
// they're only loaded on the (rare) import path.
async function extractFileContent(
  file: File
): Promise<{ text: string; formatted: boolean }> {
  const name = file.name.toLowerCase();
  const type = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx");

  if (isPdf) {
    // Try the experimental styled extraction first; if it errors or recovers
    // too little text, fall back to the proven plain-text extraction so PDF
    // import never regresses.
    try {
      const styled = await extractPdfFormatted(buffer);
      const plainLen = styled.text.replace(/<[^>]+>/g, "").trim().length;
      if (plainLen >= 30) return styled;
    } catch {
      /* fall back to plain text below */
    }
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return {
      text: Array.isArray(text) ? text.join("\n") : text,
      formatted: false,
    };
  }

  if (isDocx) {
    const mammoth = (await import("mammoth")).default;
    // convertToHtml emits <strong>/<em> for bold/italic; the styleMap turns the
    // underline run property into <u> (mammoth ignores underline by default).
    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      { styleMap: ["u => u"] }
    );
    return { text: htmlToInlineFormattedText(html), formatted: true };
  }

  // Legacy .doc (binary Word) isn't supported by mammoth; tell the user.
  throw new Error(
    "Unsupported file type. Please upload a PDF or a Word .docx file."
  );
}

// Parse an uploaded resume file into structured resumeData with AI. PERSISTS
// NOTHING — returns a draft the builder pre-fills; the user reviews and presses
// "Create resume" to save through the normal /api/resumes path.
export async function POST(req: Request) {
  // Accept one OR several files under the "file" key. Multiple documents are
  // merged into a single resume by the parser (people often keep more than one
  // version of their CV and want them combined).
  let files: File[];
  try {
    const form = await req.formData();
    files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: "Expected a file upload (multipart/form-data)." },
      { status: 400 }
    );
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files. Please upload at most ${MAX_FILES} documents.` },
      { status: 413 }
    );
  }
  for (const file of files) {
    if (file.size === 0) {
      return NextResponse.json(
        { error: `“${file.name}” is empty.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `“${file.name}” is too large. Each file must be under 5 MB.` },
        { status: 413 }
      );
    }
  }

  // Extract text from every file BEFORE resolving access, so an unreadable file
  // never burns a daily-cap unit. Multiple documents are concatenated with a
  // marker so the parser can tell them apart and merge across them.
  const multiDoc = files.length > 1;
  let text: string;
  let formatted = false;
  try {
    const parts: string[] = [];
    for (const file of files) {
      const content = await extractFileContent(file);
      const trimmed = content.text.trim();
      if (content.formatted) formatted = true;
      parts.push(
        multiDoc ? `===== DOCUMENT: ${file.name} =====\n${trimmed}` : trimmed
      );
    }
    text = parts.join("\n\n").trim();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read that file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Total readable text across all files must clear the floor; the marker lines
  // don't count toward it.
  const readableLen = text.replace(/^=====.*=====$/gm, "").trim().length;
  if (readableLen < 30) {
    return NextResponse.json(
      {
        error:
          "Couldn't find readable text in that file. If it's a scanned/image PDF, try a text-based PDF or Word document.",
      },
      { status: 422 }
    );
  }

  // One import = one cap unit (resolveAiAccess increments once), regardless of
  // how many files were merged.
  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const extracted = await extractResumeFromText(
      text,
      openrouterModel(access.apiKey, access.model),
      formatted,
      multiDoc
    );
    const resumeData = normalizeResumeData({
      ...emptyResumeData(),
      ...extracted,
    });
    return NextResponse.json({ resumeData });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(
        err instanceof Error ? err.message : String(err)
      );
    }
    console.error("resumes/import error:", err);
    const message =
      err instanceof Error ? err.message : "Resume import failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
