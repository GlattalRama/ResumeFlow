import { NextResponse } from "next/server";
import { createItem, readAll } from "@/lib/store";
import type { WorkJournalNote } from "@/lib/types";

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
  const created = await createItem("workJournal", {
    title: str(body.title).trim(),
    company: str(body.company),
    client: str(body.client),
    project: str(body.project),
    role: str(body.role),
    period: str(body.period),
    whatIDid: str(body.whatIDid),
    toolsTechnologies: str(body.toolsTechnologies),
    problemSolved: str(body.problemSolved),
    impactResult: str(body.impactResult),
    metrics: str(body.metrics),
    tags: tags(body.tags),
    resumeReady: Boolean(body.resumeReady),
    linkedResumeId: "",
    linkedSection: "",
    generatedResumeBullets: [],
    starStory: "",
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<WorkJournalNote, "id">);
  return NextResponse.json(created, { status: 201 });
}
