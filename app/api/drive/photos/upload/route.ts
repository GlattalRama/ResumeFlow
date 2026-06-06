import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, uploadImage } from "@/lib/googleDriveStore";
import type { ProfilePhotoMeta } from "@/lib/types";

// Upload a profile photo.
//  • Drive mode  — stores the image in Google Drive appDataFolder and returns
//                  { mode: "drive", profilePhotoMeta }.
//  • Local mode  — (no credentials) returns { mode: "local", profilePhoto }
//                  as a Base64 data URL for development.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";

  if (!hasGoogleCredentials()) {
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ mode: "local", profilePhoto: dataUrl });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const safeName = (file.name || "photo").replace(/[^\w.\-]/g, "_");
  const fileName = `resumeflow-photo-${randomUUID()}-${safeName}`;
  const drive = driveClient(token);
  const driveFileId = await uploadImage(drive, fileName, mimeType, buffer);

  const profilePhotoMeta: ProfilePhotoMeta = {
    driveFileId,
    fileName,
    mimeType,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json({ mode: "drive", profilePhotoMeta });
}
