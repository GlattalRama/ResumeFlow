import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, uploadImage } from "@/lib/googleDriveStore";
import type { CertificationFile } from "@/lib/types";

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
    name: file.name || "certificate",
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

  const safeName = (file.name || "certificate").replace(/[^\w.\-]/g, "_");
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
