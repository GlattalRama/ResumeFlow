import { NextResponse } from "next/server";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, getImage, deleteFile } from "@/lib/googleDriveStore";

type Ctx = { params: Promise<{ fileId: string }> };

// Stream a profile photo from Google Drive. The Google access token is used
// server-side only — the browser sees just the image bytes.
export async function GET(_req: Request, { params }: Ctx) {
  const { fileId } = await params;

  if (!hasGoogleCredentials()) {
    return NextResponse.json(
      { error: "Drive storage not configured" },
      { status: 404 }
    );
  }
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const drive = driveClient(token);
    const { buffer, mimeType } = await getImage(drive, fileId);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { fileId } = await params;

  if (!hasGoogleCredentials()) {
    return NextResponse.json({ ok: true });
  }
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const drive = driveClient(token);
    await deleteFile(drive, fileId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
