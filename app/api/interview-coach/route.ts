import { NextResponse } from "next/server";
import { createItem, readAll } from "@/lib/store";
import { INTERVIEW_QUESTION_CATEGORIES } from "@/lib/aiInterviewCoach";
import type {
  InterviewCoachEntry,
  InterviewQuestionCategory,
  InterviewQuestionSource,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const SOURCES: InterviewQuestionSource[] = [
  "manual",
  "jobDescription",
  "baseResume",
  "workJournal",
  "applicationNotes",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId");
  const entries = await readAll("interviewCoach");
  return NextResponse.json(
    applicationId === null
      ? entries
      : entries.filter((e) => e.selectedApplicationId === applicationId)
  );
}

// Create one question entry (manual question, or a generated question the
// client persists). The answer starts empty — generation is a separate,
// explicit step.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }
  const category: InterviewQuestionCategory =
    INTERVIEW_QUESTION_CATEGORIES.includes(body.category)
      ? body.category
      : "General";
  const source: InterviewQuestionSource = SOURCES.includes(body.source)
    ? body.source
    : "manual";

  const now = new Date().toISOString();
  const created = await createItem("interviewCoach", {
    selectedApplicationId:
      typeof body.selectedApplicationId === "string" ? body.selectedApplicationId : "",
    selectedResumeId:
      typeof body.selectedResumeId === "string" ? body.selectedResumeId : "",
    question,
    answer: "",
    originalAiAnswer: "",
    answerFormat: "paragraph",
    tone: "neutral",
    status: "draft",
    source,
    category,
    usedBaseResume: false,
    usedWorkJournal: false,
    evidenceUsed: [],
    gaps: [],
    aiRevisionHistory: [],
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<InterviewCoachEntry, "id">);
  return NextResponse.json(created, { status: 201 });
}
