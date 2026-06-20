import { NextResponse } from "next/server";
import { getItem, updateItem } from "@/lib/store";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { assembleEvidence } from "@/lib/interviewEvidence";
import { gradePracticeAnswer } from "@/lib/aiInterviewCoach";
import { computeOverall } from "@/lib/practice";
import type { PracticeAttempt, PracticeFeedback } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Grade one practice answer and store the feedback on the session attempt.
// Never touches the canonical InterviewCoachEntry answer.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const entryId = typeof body.entryId === "string" ? body.entryId : "";
  const practiceAnswer = typeof body.practiceAnswer === "string" ? body.practiceAnswer.trim() : "";

  if (!sessionId || !entryId) {
    return NextResponse.json({ error: "sessionId and entryId are required" }, { status: 400 });
  }
  // Validate before resolving access so a bad request never burns a cap unit.
  if (practiceAnswer.length < 10) {
    return NextResponse.json(
      { error: "Write a bit more before asking for feedback." },
      { status: 400 }
    );
  }

  const session = await getItem("interviewPracticeSessions", sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const attemptIndex = session.attempts.findIndex((a) => a.entryId === entryId);
  if (attemptIndex === -1) {
    return NextResponse.json({ error: "Question not in this session" }, { status: 404 });
  }
  const entry = await getItem("interviewCoach", entryId);
  const isTechnical = entry?.category === "Technical";

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const evidence = await assembleEvidence(
      session.selectedApplicationId,
      session.selectedResumeId
    );
    const core = await gradePracticeAnswer(
      session.attempts[attemptIndex].question,
      practiceAnswer,
      isTechnical,
      evidence,
      openrouterModel(access.apiKey, access.model)
    );
    const feedback: PracticeFeedback = { ...core, gradedAt: new Date().toISOString() };

    const attempts: PracticeAttempt[] = session.attempts.map((a, i) =>
      i === attemptIndex
        ? { ...a, practiceAnswer, feedback, answeredAt: new Date().toISOString() }
        : a
    );
    const updated = await updateItem("interviewPracticeSessions", sessionId, {
      attempts,
      overallScore: computeOverall(attempts),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(err instanceof Error ? err.message : String(err));
    }
    console.error("ai/interview-practice error:", err);
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
