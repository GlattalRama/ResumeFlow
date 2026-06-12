import { NextResponse } from "next/server";
import { getItem, updateItem } from "@/lib/store";
import { captureSnapshot, listSnapshots } from "@/lib/resumeHistory";

type Ctx = { params: Promise<{ id: string }> };

// GET: the resume's snapshots, newest first (capped per resume, so payload
// sizes stay modest).
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const resume = await getItem("resumes", id);
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await listSnapshots(id));
}

// POST { snapshotId }: restore the resume's content from a snapshot. The
// current state is force-snapshotted first, so a restore is always reversible.
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const snapshotId = typeof body.snapshotId === "string" ? body.snapshotId : "";
  if (!snapshotId) {
    return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });
  }

  const resume = await getItem("resumes", id);
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const snapshot = (await listSnapshots(id)).find((s) => s.id === snapshotId);
  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  await captureSnapshot(resume, "pre-restore", { force: true });

  const updated = await updateItem("resumes", id, {
    versionName: snapshot.versionName,
    targetRole: snapshot.targetRole,
    selectedTemplate: snapshot.selectedTemplate,
    templateStyle: snapshot.templateStyle,
    formCardState: snapshot.formCardState,
    sectionState: snapshot.sectionState,
    resumeData: snapshot.resumeData,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json(updated);
}
