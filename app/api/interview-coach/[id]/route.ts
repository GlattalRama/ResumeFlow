import { NextResponse } from "next/server";
import { deleteItem, getItem, newId, updateItem } from "@/lib/store";
import type {
  InterviewAnswerFormat,
  InterviewAnswerRevision,
  InterviewAnswerTone,
  InterviewCoachEntry,
  InterviewEntryStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const FORMATS: InterviewAnswerFormat[] = ["paragraph", "star", "bullets"];
const TONES: InterviewAnswerTone[] = ["neutral", "confident", "professional"];
const STATUSES: InterviewEntryStatus[] = [
  "draft",
  "aiGenerated",
  "userEdited",
  "final",
];

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const entry = await getItem("interviewCoach", id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

// Patch an entry. Two mutation styles:
//   • plain field updates (question, answer, status, format, tone) — manual
//     edits and saves; the client sets status explicitly (e.g. "userEdited").
//   • appendRevision {action, instruction, after} — the user ACCEPTED an AI
//     revision: the server records before/after in aiRevisionHistory and only
//     then replaces the saved answer. AI output never lands here without that
//     explicit acceptance.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const entry = await getItem("interviewCoach", id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Partial<InterviewCoachEntry> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.question === "string" && body.question.trim()) {
    patch.question = body.question.trim();
  }
  if (typeof body.answer === "string") patch.answer = body.answer;
  if (FORMATS.includes(body.answerFormat)) patch.answerFormat = body.answerFormat;
  if (TONES.includes(body.tone)) patch.tone = body.tone;
  if (STATUSES.includes(body.status)) patch.status = body.status;

  if (body.appendRevision && typeof body.appendRevision === "object") {
    const r = body.appendRevision;
    const after = typeof r.after === "string" ? r.after.trim() : "";
    if (!after) {
      return NextResponse.json(
        { error: "appendRevision.after is required" },
        { status: 400 }
      );
    }
    const revision: InterviewAnswerRevision = {
      id: newId(),
      action: typeof r.action === "string" ? r.action : "improve",
      before: entry.answer,
      after,
      instruction: typeof r.instruction === "string" ? r.instruction : "",
      createdAt: new Date().toISOString(),
    };
    patch.aiRevisionHistory = [...entry.aiRevisionHistory, revision];
    patch.answer = after;
    // An accepted AI revision counts as AI content again — unless the user had
    // already locked the answer as final, which acceptance keeps.
    patch.status = entry.status === "final" ? "final" : "aiGenerated";
  }

  const updated = await updateItem("interviewCoach", id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteItem("interviewCoach", id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
