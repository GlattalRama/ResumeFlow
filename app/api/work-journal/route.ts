import { NextResponse } from "next/server";
import { createItem, readAll } from "@/lib/store";
import { ACHIEVEMENT_CATEGORIES, type AchievementCategory, type Star, type WorkJournalNote } from "@/lib/types";
import { STAR_SCHEMA_VERSION, legacyFromStar } from "@/lib/career/migrate";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function tags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
}

function readStar(v: unknown): Star {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    situation: str(o.situation),
    task: str(o.task),
    action: str(o.action),
    result: str(o.result),
  };
}

function readCategory(v: unknown): AchievementCategory | "" {
  return (ACHIEVEMENT_CATEGORIES as readonly string[]).includes(str(v))
    ? (str(v) as AchievementCategory)
    : "";
}

export async function GET() {
  const notes = await readAll("workJournal");
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!str(body.title).trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const now = new Date().toISOString();
  // STAR is the source of truth; mirror it into the legacy prose fields so
  // existing AI digests and add-to-resume keep working. Fall back to any legacy
  // fields sent directly (older clients).
  const star = readStar(body.star);
  const hasStar = Object.values(star).some((f) => f.trim().length > 0);
  const legacy = hasStar
    ? legacyFromStar(star)
    : { whatIDid: str(body.whatIDid), problemSolved: str(body.problemSolved), impactResult: str(body.impactResult) };
  const created = await createItem("workJournal", {
    title: str(body.title).trim(),
    company: str(body.company),
    client: str(body.client),
    project: str(body.project),
    role: str(body.role),
    period: str(body.period),
    whatIDid: legacy.whatIDid,
    toolsTechnologies: str(body.toolsTechnologies),
    problemSolved: legacy.problemSolved,
    impactResult: legacy.impactResult,
    metrics: str(body.metrics),
    tags: tags(body.tags),
    resumeReady: Boolean(body.resumeReady),
    linkedResumeId: "",
    linkedSection: "",
    generatedResumeBullets: [],
    starStory: "",
    createdAt: now,
    updatedAt: now,
    star,
    category: readCategory(body.category),
    schemaVersion: STAR_SCHEMA_VERSION,
  } satisfies Omit<WorkJournalNote, "id">);
  return NextResponse.json(created, { status: 201 });
}
