import { NextResponse } from "next/server";
import { createItem, getItem, readAll, updateItem } from "@/lib/store";
import { decryptApiKey, loadSettings } from "@/lib/aiSettings";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { assembleEvidence } from "@/lib/interviewEvidence";
import {
  generateInterviewAnswer,
  generateInterviewQuestions,
  reviseInterviewAnswer,
  REVISION_ACTIONS,
  type RevisionAction,
} from "@/lib/aiInterviewCoach";
import type { InterviewCoachEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode = body.mode as "questions" | "answer" | "revise";

  try {
    if (mode === "questions") return await handleQuestions(body);
    if (mode === "answer") return await handleAnswer(body);
    if (mode === "revise") return await handleRevise(body);
  } catch (err) {
    if (isCreditsError(err)) {
      // Only alert the owner when the SHARED key was in play (no BYOK key).
      const settings = await loadSettings().catch(() => null);
      if (!(settings && decryptApiKey(settings))) {
        void notifyOwnerCreditsExhausted(
          err instanceof Error ? err.message : String(err)
        );
      }
    }
    console.error("ai/interview-coach error:", err);
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}

// FLOW B: generate questions from the selected application's JD + the
// candidate's material. Persists each NEW question as a draft entry (existing
// identical questions are skipped, and saved answers are never touched).
async function handleQuestions(body: Record<string, unknown>) {
  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId : "";
  const resumeId = typeof body.resumeId === "string" ? body.resumeId : "";
  if (!applicationId) {
    return NextResponse.json(
      { error: "applicationId is required" },
      { status: 400 }
    );
  }
  const application = await getItem("applications", applicationId);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (!application.jobDescription.trim()) {
    return NextResponse.json(
      { error: "This application has no job description to generate from." },
      { status: 400 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const evidence = await assembleEvidence(applicationId, resumeId);
  const questions = await generateInterviewQuestions(
    evidence,
    openrouterModel(access.apiKey, access.model)
  );

  // Skip questions that already exist for this application (regeneration must
  // never duplicate or overwrite saved work).
  const existing = await readAll("interviewCoach");
  const seen = new Set(
    existing
      .filter((e) => e.selectedApplicationId === applicationId)
      .map((e) => e.question.trim().toLowerCase())
  );

  const now = new Date().toISOString();
  const created: InterviewCoachEntry[] = [];
  for (const q of questions) {
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    created.push(
      await createItem("interviewCoach", {
        selectedApplicationId: applicationId,
        selectedResumeId: resumeId,
        question: q.question,
        answer: "",
        originalAiAnswer: "",
        answerFormat: "paragraph",
        tone: "neutral",
        status: "draft",
        source: "jobDescription",
        category: q.category,
        usedBaseResume: false,
        usedWorkJournal: false,
        evidenceUsed: [],
        journalStoriesUsed: [],
        gaps: [],
        aiRevisionHistory: [],
        createdAt: now,
        updatedAt: now,
      })
    );
  }
  return NextResponse.json({ created, skipped: questions.length - created.length });
}

// Generate (or, with explicit confirmation, regenerate) the answer for one
// entry. A saved answer is never replaced without confirmRegenerate.
async function handleAnswer(body: Record<string, unknown>) {
  const entryId = typeof body.entryId === "string" ? body.entryId : "";
  const entry = entryId ? await getItem("interviewCoach", entryId) : undefined;
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  if (entry.answer.trim() && body.confirmRegenerate !== true) {
    return NextResponse.json(
      {
        error:
          "This question already has a saved answer. Confirm regeneration to replace it.",
        needsConfirmation: true,
      },
      { status: 409 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const evidence = await assembleEvidence(
    entry.selectedApplicationId,
    entry.selectedResumeId
  );
  const result = await generateInterviewAnswer(
    entry.question,
    evidence,
    entry.answerFormat,
    entry.tone,
    openrouterModel(access.apiKey, access.model)
  );

  const updated = await updateItem("interviewCoach", entry.id, {
    answer: result.answer,
    // Keep the FIRST AI answer as the reference original.
    originalAiAnswer: entry.originalAiAnswer || result.answer,
    status: "aiGenerated",
    usedBaseResume: evidence.usedBaseResume,
    usedWorkJournal: evidence.usedWorkJournal,
    evidenceUsed: result.evidenceUsed,
    journalStoriesUsed: result.storiesUsed,
    gaps: result.gaps,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json(updated);
}

// Produce a revised answer for review. Persists NOTHING — the client shows
// the revision and only an explicit accept (PATCH appendRevision) saves it.
async function handleRevise(body: Record<string, unknown>) {
  const entryId = typeof body.entryId === "string" ? body.entryId : "";
  const action = body.action as RevisionAction;
  if (!(action in REVISION_ACTIONS)) {
    return NextResponse.json({ error: "Unknown revision action" }, { status: 400 });
  }
  const entry = entryId ? await getItem("interviewCoach", entryId) : undefined;
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  if (!entry.answer.trim()) {
    return NextResponse.json(
      { error: "There is no saved answer to revise yet." },
      { status: 400 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const evidence = await assembleEvidence(
    entry.selectedApplicationId,
    entry.selectedResumeId
  );
  const revised = await reviseInterviewAnswer(
    entry.question,
    entry.answer,
    action,
    evidence,
    openrouterModel(access.apiKey, access.model)
  );
  return NextResponse.json({
    revised,
    action,
    instruction: REVISION_ACTIONS[action],
  });
}
