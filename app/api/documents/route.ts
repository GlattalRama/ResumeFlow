import { NextResponse } from "next/server";
import { createItem, readAll, readByApplication } from "@/lib/store";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, uploadImage } from "@/lib/googleDriveStore";
import type { DocumentMeta } from "@/lib/types";

export const maxDuration = 60;

// Uploaded application documents (the resume/cover letter actually sent).
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId");
  const docs = applicationId
    ? await readByApplication("documents", applicationId)
    : await readAll("documents");
  // Never ship inline file bytes to the client; the file route serves them.
  return NextResponse.json(docs.map(({ dataUrl: _omit, ...d }) => d));
}

// Accepts either JSON (link-only metadata, as before) or multipart form data
// with a `file` field (PDF / .docx) plus the same metadata fields.
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await req.json();
    const created = await createItem("documents", {
      applicationId: body.applicationId,
      resumeVersionId: body.resumeVersionId || "",
      name: body.name || "",
      type: body.type || "Other",
      link: body.link || "",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json(created, { status: 201 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const applicationId = String(form.get("applicationId") ?? "").trim();
  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Documents must be under 5 MB." },
      { status: 413 }
    );
  }
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, Word (.docx) or text (.txt) file." },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const meta: Omit<DocumentMeta, "id"> = {
    applicationId,
    resumeVersionId: String(form.get("resumeVersionId") ?? ""),
    name: String(form.get("name") ?? "").trim() || file.name || "document",
    type: String(form.get("type") ?? "") || "Resume",
    link: String(form.get("link") ?? ""),
    createdAt: new Date().toISOString(),
    mimeType,
    size: file.size,
  };

  if (!hasGoogleCredentials()) {
    const created = await createItem("documents", {
      ...meta,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    });
    const { dataUrl: _omit, ...safe } = created;
    return NextResponse.json(safe, { status: 201 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const safeName = meta.name.replace(/[^\w.\-]/g, "_").slice(0, 120);
  const driveFileId = await uploadImage(
    driveClient(token),
    `resumeflow-document-${applicationId}-${safeName}`,
    mimeType,
    buffer
  );
  const created = await createItem("documents", { ...meta, driveFileId });
  return NextResponse.json(created, { status: 201 });
}
