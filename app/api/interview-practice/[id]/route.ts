import { NextResponse } from "next/server";
import { deleteItem, getItem, updateItem } from "@/lib/store";
import { computeOverall } from "@/lib/practice";
import type { PracticeAttempt, PracticeSession, PracticeSessionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES: PracticeSessionStatus[] = ["in-progress", "completed"];

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await getItem("interviewPracticeSessions", id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

// Patch a session. Practice answers are merged by entryId so existing AI
// feedback (set only by the grading route) is never clobbered here.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const session = await getItem("interviewPracticeSessions", id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Partial<PracticeSession> = { updatedAt: new Date().toISOString() };

  if (Array.isArray(body.answers)) {
    const now = new Date().toISOString();
    const updates = new Map<string, string>();
    for (const a of body.answers) {
      if (a && typeof a.entryId === "string" && typeof a.practiceAnswer === "string") {
        updates.set(a.entryId, a.practiceAnswer);
      }
    }
    const attempts: PracticeAttempt[] = session.attempts.map((att) =>
      updates.has(att.entryId)
        ? { ...att, practiceAnswer: updates.get(att.entryId)!, answeredAt: now }
        : att
    );
    patch.attempts = attempts;
    patch.overallScore = computeOverall(attempts);
  }

  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (STATUSES.includes(body.status)) patch.status = body.status;

  const updated = await updateItem("interviewPracticeSessions", id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteItem("interviewPracticeSessions", id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
