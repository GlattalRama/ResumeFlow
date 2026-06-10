import { NextResponse } from "next/server";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { extractResumeFromText } from "@/lib/aiImport";
import { emptyResumeData, normalizeResumeData } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — resumes are small; reject blobs early.

// Pull plain text out of an uploaded resume file. PDF via unpdf, .docx via
// mammoth. Both libs are dynamically imported so they're only loaded on the
// (rare) import path, not on every cold start.
async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx");

  if (isPdf) {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }

  if (isDocx) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
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
  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    file = f;
  } catch {
    return NextResponse.json(
      { error: "Expected a file upload (multipart/form-data)." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Please upload a resume under 5 MB." },
      { status: 413 }
    );
  }

  // Extract text BEFORE resolving access, so an unreadable file never burns a
  // daily-cap unit.
  let text: string;
  try {
    text = (await extractFileText(file)).trim();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read that file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  if (text.length < 30) {
    return NextResponse.json(
      {
        error:
          "Couldn't find readable text in that file. If it's a scanned/image PDF, try a text-based PDF or Word document.",
      },
      { status: 422 }
    );
  }

  // One import = one cap unit (resolveAiAccess increments once).
  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const extracted = await extractResumeFromText(
      text,
      openrouterModel(access.apiKey, access.model)
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
