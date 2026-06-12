import { NextResponse } from "next/server";
import { deleteItem, getItem, updateItem } from "@/lib/store";
import type { WorkJournalNote } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Fields the client may patch directly. Linkage fields (linkedResumeId,
// linkedSection) are owned by the add-to-resume endpoint.
const STRING_FIELDS = [
  "title",
  "company",
  "client",
  "project",
  "role",
  "period",
  "whatIDid",
  "toolsTechnologies",
  "problemSolved",
  "impactResult",
  "metrics",
  "starStory",
] as const;

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const note = await getItem("workJournal", id);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<WorkJournalNote> = {
    updatedAt: new Date().toISOString(),
  };
  for (const f of STRING_FIELDS) {
    if (typeof body[f] === "string") patch[f] = body[f];
  }
  if (Array.isArray(body.tags)) {
    patch.tags = body.tags
      .filter((t: unknown): t is string => typeof t === "string")
      .map((t: string) => t.trim())
      .filter(Boolean);
  }
  if (typeof body.resumeReady === "boolean") patch.resumeReady = body.resumeReady;
  if (Array.isArray(body.generatedResumeBullets)) {
    patch.generatedResumeBullets = body.generatedResumeBullets
      .filter((b: unknown): b is string => typeof b === "string")
      .map((b: string) => b.trim())
      .filter(Boolean);
  }

  const updated = await updateItem("workJournal", id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteItem("workJournal", id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
