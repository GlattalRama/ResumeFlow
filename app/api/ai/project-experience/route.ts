import { NextResponse } from "next/server";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { decryptApiKey, loadSettings } from "@/lib/aiSettings";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { extractProjects, type SourceImage } from "@/lib/aiProjectExtract";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
const MAX_FILES = 5;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Plain-text extraction for uploaded documents. Unlike the resume importer we
// don't need bold/italic heuristics here — the model only reads the words.
async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  if (type === "text/plain" || name.endsWith(".txt") || name.endsWith(".md")) {
    return buffer.toString("utf8");
  }
  throw new Error(
    `“${file.name}”: unsupported file type. Use PDF, Word (.docx), plain text, or a PNG/JPEG/WebP image.`
  );
}

// Extract project-experience drafts from pasted text and/or uploaded
// documents/screenshots. PERSISTS NOTHING — the client shows the drafts for
// review and saves them through /api/project-experience.
export async function POST(req: Request) {
  let pasted = "";
  let files: File[];
  try {
    const form = await req.formData();
    pasted = String(form.get("text") ?? "");
    files = form.getAll("file").filter((f): f is File => f instanceof File);
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  if (!pasted.trim() && files.length === 0) {
    return NextResponse.json(
      { error: "Provide some text, a document, or an image to extract from." },
      { status: 400 }
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files. Please upload at most ${MAX_FILES}.` },
      { status: 413 }
    );
  }

  try {
    const texts: string[] = pasted.trim() ? [pasted.trim()] : [];
    const images: SourceImage[] = [];
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
      if (IMAGE_TYPES.has(file.type)) {
        images.push({
          mediaType: file.type,
          data: new Uint8Array(await file.arrayBuffer()),
        });
      } else {
        const text = (await fileToText(file)).trim();
        if (text) texts.push(`--- ${file.name} ---\n${text}`);
      }
    }

    const access = await resolveAiAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.message },
        { status: access.status }
      );
    }
    const model = openrouterModel(access.apiKey, access.model);
    const projects = await extractProjects(model, texts.join("\n\n"), images);
    return NextResponse.json({ projects });
  } catch (err) {
    if (isCreditsError(err)) {
      const settings = await loadSettings().catch(() => null);
      if (!(settings && decryptApiKey(settings))) {
        void notifyOwnerCreditsExhausted(
          err instanceof Error ? err.message : String(err)
        );
      }
    }
    console.error("ai/project-experience error:", err);
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
