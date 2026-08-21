import { NextResponse } from "next/server";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, renameFile } from "@/lib/googleDriveStore";

type Ctx = { params: Promise<{ fileId: string }> };

// Rename a certificate file in Google Drive so the stored file matches the
// name shown on the Certifications card. The metadata rename itself lives in
// resumeData.certificationFiles and rides the normal resume save; this route
// only keeps the Drive appDataFolder file name in sync. Local-mode (dataUrl)
// files have no Drive file, so the client skips this call for them.
export async function PATCH(req: Request, { params }: Ctx) {
  const { fileId } = await params;
  let name: string;
  try {
    const body = await req.json();
    name = String(body?.name ?? "").trim();
  } catch {
    name = "";
  }
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  if (!hasGoogleCredentials()) {
    return NextResponse.json({ ok: true });
  }
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const drive = driveClient(token);
    await renameFile(drive, fileId, name.replace(/[^\w.\- ]/g, "_").slice(0, 160));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}
