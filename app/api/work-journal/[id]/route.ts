import { NextResponse } from "next/server";
import { deleteItem, getItem, updateItem } from "@/lib/store";
import { ACHIEVEMENT_CATEGORIES, type Star, type WorkJournalNote } from "@/lib/types";
import { STAR_SCHEMA_VERSION, legacyFromStar } from "@/lib/career/migrate";
import { metricsToText, readEvidence, readMetricsList } from "@/lib/career/metrics";

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

  // STAR is the source of truth; when it changes, re-mirror the legacy prose
  // fields so AI digests and add-to-resume stay in sync.
  if (body.star && typeof body.star === "object") {
    const s = body.star as Record<string, unknown>;
    const star: Star = {
      situation: typeof s.situation === "string" ? s.situation : "",
      task: typeof s.task === "string" ? s.task : "",
      action: typeof s.action === "string" ? s.action : "",
      result: typeof s.result === "string" ? s.result : "",
    };
    patch.star = star;
    patch.schemaVersion = STAR_SCHEMA_VERSION;
    Object.assign(patch, legacyFromStar(star));
  }
  if (typeof body.category === "string") {
    patch.category = (ACHIEVEMENT_CATEGORIES as readonly string[]).includes(body.category)
      ? (body.category as WorkJournalNote["category"])
      : "";
  }
  // Structured metrics are the source of truth; re-mirror the legacy string.
  if (Array.isArray(body.metricsList)) {
    const metricsList = readMetricsList(body.metricsList);
    patch.metricsList = metricsList;
    patch.metrics = metricsToText(metricsList);
  }
  if (Array.isArray(body.evidence)) {
    patch.evidence = readEvidence(body.evidence);
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
