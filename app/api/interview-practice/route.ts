import { NextResponse } from "next/server";
import { createItem, newId, readAll } from "@/lib/store";
import type { PracticeAttempt, PracticeMode, PracticeOrder, PracticeSession } from "@/lib/types";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Fisher-Yates, in place. Shuffling happens here (not in the client) so a
// repeat of a shuffled set gets a fresh order each time.
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Numeric weakness signal per entry on a 0-10 scale, from the MOST RECENT of:
// an AI feedback overall (gradedAt) or a flash-card self-grade (answeredAt,
// mapped missed=0 / almost=4 / gotIt=8). Entries never practiced return 5, so
// they sort after known-weak but before known-strong.
const SELF_GRADE_VALUE: Record<string, number> = { missed: 0, almost: 4, gotIt: 8 };

function latestSignals(sessions: PracticeSession[]): Map<string, { value: number; at: string }> {
  const m = new Map<string, { value: number; at: string }>();
  const consider = (entryId: string, value: number, at: string) => {
    if (!at) return;
    const prev = m.get(entryId);
    if (!prev || at.localeCompare(prev.at) > 0) m.set(entryId, { value, at });
  };
  for (const s of sessions) {
    for (const a of s.attempts) {
      if (a.feedback) consider(a.entryId, a.feedback.overall, a.feedback.gradedAt);
      if (a.selfGrade) consider(a.entryId, SELF_GRADE_VALUE[a.selfGrade] ?? 5, a.answeredAt);
    }
  }
  return m;
}

export async function GET() {
  const sessions = await readAll("interviewPracticeSessions");
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return NextResponse.json(sessions);
}

// Create a practice session (or a repeat of one) from a set of question ids.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const entryIds = Array.isArray(body.entryIds)
    ? body.entryIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  if (entryIds.length === 0) {
    return NextResponse.json({ error: "Select at least one question." }, { status: 400 });
  }

  // Snapshot the question text so history stays stable if the entry changes.
  const entries = await readAll("interviewCoach");
  const byId = new Map(entries.map((e) => [e.id, e]));
  const attempts: PracticeAttempt[] = [];
  for (const id of entryIds) {
    const entry = byId.get(id);
    if (!entry) continue;
    attempts.push({ entryId: id, question: entry.question, practiceAnswer: "", answeredAt: "" });
  }
  if (attempts.length === 0) {
    return NextResponse.json({ error: "None of the selected questions were found." }, { status: 400 });
  }

  const mode: PracticeMode = body.mode === "flashcards" ? "flashcards" : "full";
  const order: PracticeOrder =
    body.order === "shuffle" ? "shuffle" : body.order === "weakestFirst" ? "weakestFirst" : "inOrder";
  if (order === "shuffle") shuffle(attempts);
  if (order === "weakestFirst") {
    // Sort ascending by the latest weakness signal across ALL past sessions;
    // ties keep the selection order (Array.prototype.sort is stable).
    const signals = latestSignals(await readAll("interviewPracticeSessions"));
    attempts.sort(
      (a, b) => (signals.get(a.entryId)?.value ?? 5) - (signals.get(b.entryId)?.value ?? 5)
    );
  }

  const now = new Date().toISOString();
  const created = await createItem("interviewPracticeSessions", {
    setId: str(body.setId) || newId(),
    name: str(body.name).trim() || "Practice session",
    source: str(body.source),
    entryIds: attempts.map((a) => a.entryId),
    attempts,
    status: "in-progress",
    overallScore: 0,
    mode,
    order,
    repeatOf: str(body.repeatOf) || undefined,
    selectedApplicationId: str(body.selectedApplicationId),
    selectedResumeId: str(body.selectedResumeId),
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<PracticeSession, "id">);
  return NextResponse.json(created, { status: 201 });
}
