import { NextResponse } from "next/server";
import { deleteItem, getItem } from "@/lib/store";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { getAccessToken } from "@/lib/serverSession";
import { driveClient, deleteFile } from "@/lib/googleDriveStore";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const doc = await getItem("documents", id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteItem("documents", id);
  // Best effort: drop the stored file too (the metadata is already gone).
  if (doc.driveFileId && hasGoogleCredentials()) {
    try {
      const token = await getAccessToken();
      if (token) await deleteFile(driveClient(token), doc.driveFileId);
    } catch {
      // An orphaned Drive file is harmless; don't fail the delete.
    }
  }
  return NextResponse.json({ ok: true });
}
