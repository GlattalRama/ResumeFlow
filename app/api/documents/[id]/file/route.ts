import { NextResponse } from "next/server";
import { getItem } from "@/lib/store";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, getImage } from "@/lib/googleDriveStore";

type Ctx = { params: Promise<{ id: string }> };

// Serve an uploaded application document inline (PDFs open in the browser).
// Drive mode streams the appDataFolder file with the server-held token; local
// mode decodes the inline dataUrl.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const doc = await getItem("documents", id);
  if (!doc || (!doc.driveFileId && !doc.dataUrl)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const filename = (doc.name || "document").replace(/[\r\n"]/g, "").slice(0, 160);
  const headers = (mimeType: string) => ({
    "Content-Type": mimeType,
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "private, max-age=3600",
  });

  if (doc.dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(doc.dataUrl);
    if (!m) return NextResponse.json({ error: "Corrupt file" }, { status: 500 });
    return new Response(new Uint8Array(Buffer.from(m[2], "base64")), {
      headers: headers(m[1]),
    });
  }

  if (!hasGoogleCredentials()) {
    return NextResponse.json({ error: "Drive storage not configured" }, { status: 404 });
  }
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const { buffer, mimeType } = await getImage(driveClient(token), doc.driveFileId!);
    return new Response(new Uint8Array(buffer), {
      headers: headers(doc.mimeType || mimeType),
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
