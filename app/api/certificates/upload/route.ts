import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, uploadImage } from "@/lib/googleDriveStore";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { suggestCertificateFileName } from "@/lib/aiImport";
import type { CertificationFile } from "@/lib/types";

export const maxDuration = 60;

// Upload a certificate document (PDF or image) for the Certifications section.
//  • Drive mode  — stores the file in Google Drive appDataFolder; it is later
//                  streamed/deleted via the generic /api/drive/photos/[fileId]
//                  route (which serves any appDataFolder file by id).
//  • Local mode  — (no credentials) keeps the bytes inline as a Base64 dataUrl
//                  for development.
// Returns { certificationFile } either way; the builder appends it to
// resumeData.certificationFiles and the normal save path persists the metadata.

const MAX_BYTES = 5 * 1024 * 1024; // matches the resume-import per-file cap

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

// BEST-EFFORT auto-naming: read the PDF's text and ask the AI for the
// certification's title (e.g. "AWS Certified Solutions Architect – 2023.pdf").
// Any failure — image upload (no text layer), scanned PDF, missing AI consent,
// daily cap reached, model error — returns null and the upload proceeds under
// the original filename. Consumes one daily-cap unit only when it actually
// reaches the model. The user can always rename the file manually afterwards.
async function suggestName(
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  if (mimeType !== "application/pdf") return null;
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const plain = (Array.isArray(text) ? text.join("\n") : text).trim();
    if (plain.length < 20) return null;

    const access = await resolveAiAccess();
    if (!access.ok) return null;
    const suggested = await suggestCertificateFileName(
      plain,
      openrouterModel(access.apiKey, access.model)
    );
    if (!suggested) return null;
    // Keep the name filesystem/Drive-friendly and bounded.
    const clean = suggested.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    return clean ? `${clean}.pdf` : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Certificates must be under 5 MB." },
      { status: 413 }
    );
  }
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF or an image (PNG/JPG/WebP)." },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base: Omit<CertificationFile, "driveFileId" | "dataUrl"> = {
    id: randomUUID(),
    name: (await suggestName(buffer, mimeType)) ?? (file.name || "certificate"),
    mimeType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };

  if (!hasGoogleCredentials()) {
    const certificationFile: CertificationFile = {
      ...base,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    };
    return NextResponse.json({ certificationFile });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const safeName = base.name.replace(/[^\w.\-]/g, "_");
  const drive = driveClient(token);
  const driveFileId = await uploadImage(
    drive,
    `resumeflow-certificate-${base.id}-${safeName}`,
    mimeType,
    buffer
  );

  const certificationFile: CertificationFile = { ...base, driveFileId };
  return NextResponse.json({ certificationFile });
}
