// Interview Coach AI: JD-based question generation, evidence-grounded answer
// generation, and answer revisions.
//
// Answers are grounded in the user's own material, in priority order:
//   1. Work Journal notes
//   2. Base Resume
//   3. selected resume version
//   4. selected application / job description
//   5. application notes
//   6. general best practices only if needed
// The model must not invent experience: when evidence is missing it reports
// gaps (with what to add to the Work Journal) instead of fabricating. Nothing
// in this module persists — routes/clients decide what to save after review.
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import { htmlToLines } from "./richText";
import { INTERVIEW_QUESTION_CATEGORIES } from "./constants";
import type {
  Application,
  InterviewAnswerFormat,
  InterviewAnswerTone,
  InterviewQuestionCategory,
  Note,
  ResumeData,
  WorkJournalNote,
} from "./types";

export { INTERVIEW_QUESTION_CATEGORIES };

// Categories the JD-based generator may assign (everything except the
// manual-only "General").
const GENERATED_CATEGORIES = INTERVIEW_QUESTION_CATEGORIES.filter(
  (c) => c !== "General"
);

// ---- Evidence digest -------------------------------------------------------

export interface InterviewEvidence {
  digest: string;
  usedBaseResume: boolean;
  usedWorkJournal: boolean;
}

function resumeLines(d: ResumeData, label: string): string[] {
  const lines: string[] = [`## ${label}`];
  if (d.basics.title) lines.push(`Title: ${d.basics.title}`);
  const summary = htmlToLines(d.basics.summary).join(" ");
  if (summary) lines.push(`Summary: ${summary}`);
  for (const exp of (d.experience || []).slice(0, 6)) {
    lines.push(
      `Role: ${exp.role} at ${exp.company} (${[exp.startDate, exp.endDate]
        .filter(Boolean)
        .join(" – ")})`
    );
    for (const h of (exp.highlights || []).slice(0, 6)) lines.push(`  - ${h}`);
  }
  const skills = [
    ...(d.areasOfExpertise || []),
    ...(d.skillCategories || []).map((s) => `${s.category}: ${s.value}`),
  ]
    .filter(Boolean)
    .join("; ");
  if (skills) lines.push(`Skills: ${skills}`);
  const certs = (d.certifications || []).join(", ");
  if (certs) lines.push(`Certifications: ${certs}`);
  return lines;
}

function journalLines(notes: WorkJournalNote[]): string[] {
  // Most recently updated first; resume-ready notes are the strongest evidence.
  const picked = [...notes]
    .sort((a, b) => {
      if (a.resumeReady !== b.resumeReady) return a.resumeReady ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 12);
  if (picked.length === 0) return [];
  const lines = ["## Work Journal (the candidate's own captured stories)"];
  for (const n of picked) {
    const meta = [n.role, n.company, n.project, n.period].filter(Boolean).join(", ");
    lines.push(`Story "${n.title}"${meta ? ` (${meta})` : ""}:`);
    if (n.whatIDid) lines.push(`  What: ${n.whatIDid}`);
    if (n.problemSolved) lines.push(`  Problem: ${n.problemSolved}`);
    if (n.impactResult) lines.push(`  Impact: ${n.impactResult}`);
    if (n.metrics) lines.push(`  Metrics: ${n.metrics}`);
    if (n.toolsTechnologies) lines.push(`  Tools: ${n.toolsTechnologies}`);
  }
  return lines;
}

function applicationLines(app: Application, notes: Note[]): string[] {
  const lines = [
    "## Target application",
    `Company: ${app.company || "(unknown)"}`,
    `Job title: ${app.jobTitle || "(unknown)"}`,
  ];
  if (app.jobId) lines.push(`Job ID: ${app.jobId}`);
  if (app.jobDescription) {
    lines.push("Job description:", app.jobDescription.slice(0, 4000));
  }
  const noteTexts = notes.slice(0, 10).map((n) => `  [${n.type}] ${n.text}`);
  if (noteTexts.length > 0) lines.push("Application notes:", ...noteTexts);
  return lines;
}

// Assemble the evidence digest from whatever sources are available. Order in
// the digest mirrors the answering priority order.
export function buildEvidence(opts: {
  journalNotes: WorkJournalNote[];
  baseResume: ResumeData | null;
  selectedResume: { name: string; data: ResumeData } | null;
  application: Application | null;
  applicationNotes: Note[];
}): InterviewEvidence {
  const sections: string[] = [];
  const journal = journalLines(opts.journalNotes);
  if (journal.length > 0) sections.push(journal.join("\n"));
  if (opts.baseResume) {
    sections.push(resumeLines(opts.baseResume, "Base Resume").join("\n"));
  }
  if (opts.selectedResume) {
    sections.push(
      resumeLines(
        opts.selectedResume.data,
        `Selected resume version: ${opts.selectedResume.name}`
      ).join("\n")
    );
  }
  if (opts.application) {
    sections.push(
      applicationLines(opts.application, opts.applicationNotes).join("\n")
    );
  }
  return {
    digest: sections.join("\n\n"),
    usedBaseResume: !!opts.baseResume,
    usedWorkJournal: journal.length > 0,
  };
}

// ---- Question generation (Flow B) ------------------------------------------

export interface GeneratedQuestion {
  question: string;
  category: InterviewQuestionCategory;
}

const questionsSchema = jsonSchema<{
  questions: { question: string; category: string }[];
}>({
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          category: { type: "string", enum: GENERATED_CATEGORIES },
        },
        required: ["question", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
});

export async function generateInterviewQuestions(
  evidence: InterviewEvidence,
  model: LanguageModel
): Promise<GeneratedQuestion[]> {
  const { object } = await generateObject({
    model,
    schema: questionsSchema,
    system: [
      "You are an experienced interviewer preparing a candidate for a specific job.",
      "From the candidate material and target application below, generate 14-20 interview questions the candidate is likely to face.",
      `Assign each question one category: ${GENERATED_CATEGORIES.join(", ")}.`,
      "Cover every category with at least one question. 'Resume Based' questions probe specific items on the candidate's resume. 'Gap / Risk' questions probe weaknesses: missing JD requirements, employment gaps, short tenures, or skills the JD wants that the resume lacks.",
      "Write questions as an interviewer would actually phrase them. No numbering, no duplicates.",
    ].join("\n"),
    prompt: evidence.digest || "(no candidate material provided)",
    maxOutputTokens: 1500,
  });
  const valid = new Set<string>(GENERATED_CATEGORIES);
  return object.questions
    .map((q) => ({
      question: q.question.trim(),
      category: (valid.has(q.category)
        ? q.category
        : "Behavioral") as InterviewQuestionCategory,
    }))
    .filter((q) => q.question.length > 0);
}

// ---- Answer generation -------------------------------------------------------

export interface GeneratedAnswer {
  answer: string;
  evidenceUsed: string[];
  gaps: string[];
}

const answerSchema = jsonSchema<{
  answer: string;
  evidenceUsed: string[];
  gaps: string[];
}>({
  type: "object",
  properties: {
    answer: {
      type: "string",
      description: "The interview answer, first person, plain text.",
    },
    evidenceUsed: {
      type: "array",
      items: { type: "string" },
      description:
        "Short references to the specific evidence drawn on, e.g. 'Work Journal: Migrated batch jobs' or 'Base Resume: role at Acme'. Empty if none.",
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description:
        "What was missing: information the question needs that the evidence doesn't cover, each with a suggestion of what to add to the Work Journal. Empty if nothing was missing.",
    },
  },
  required: ["answer", "evidenceUsed", "gaps"],
  additionalProperties: false,
});

const FORMAT_INSTRUCTION: Record<InterviewAnswerFormat, string> = {
  paragraph: "Format: 1-2 spoken-style paragraphs, 60-180 words.",
  star: "Format: STAR — four short labeled parts (Situation / Task / Action / Result), each 1-3 sentences.",
  bullets: "Format: 3-6 concise bullet points, one line each, no leading dashes.",
};

const TONE_INSTRUCTION: Record<InterviewAnswerTone, string> = {
  neutral: "Tone: natural and balanced.",
  confident: "Tone: confident and assertive — own the achievements, no hedging.",
  professional: "Tone: polished and professional.",
};

const GROUNDING_RULES = [
  "Ground the answer in the candidate's evidence, preferring sources in this order: 1) Work Journal stories, 2) Base Resume, 3) the selected resume version, 4) the target application / job description, 5) application notes, 6) general interview best practices only where no personal evidence is needed.",
  "HARD RULE: never invent experience, employers, projects, tools, or numbers that are not in the evidence. If the question asks about experience the evidence doesn't show, say what the candidate CAN truthfully claim, and report the rest as a gap (with what they should add to their Work Journal).",
  "List in evidenceUsed the specific items you drew from. List in gaps what was missing.",
].join("\n");

export async function generateInterviewAnswer(
  question: string,
  evidence: InterviewEvidence,
  format: InterviewAnswerFormat,
  tone: InterviewAnswerTone,
  model: LanguageModel
): Promise<GeneratedAnswer> {
  const { object } = await generateObject({
    model,
    schema: answerSchema,
    system: [
      "You are an interview coach writing the answer a candidate should give, in their voice (first person).",
      FORMAT_INSTRUCTION[format],
      TONE_INSTRUCTION[tone],
      GROUNDING_RULES,
    ].join("\n"),
    prompt: [
      `Interview question: ${question}`,
      "",
      "Candidate evidence:",
      evidence.digest || "(none provided)",
    ].join("\n"),
    maxOutputTokens: 1000,
  });
  return {
    answer: object.answer.trim(),
    evidenceUsed: object.evidenceUsed.map((e) => e.trim()).filter(Boolean),
    gaps: object.gaps.map((g) => g.trim()).filter(Boolean),
  };
}

// ---- Answer revision ---------------------------------------------------------

// Revision actions the user can ask for. The instruction is also stored on the
// accepted revision record so history is self-describing.
export const REVISION_ACTIONS = {
  improve: "Improve this answer: clearer, more specific, stronger.",
  shorter: "Make this answer shorter and punchier without losing the substance.",
  detailed: "Make this answer more detailed, expanding on the existing points only.",
  star: "Restructure this answer into STAR format: Situation / Task / Action / Result, each labeled, 1-3 sentences per part.",
  confident: "Rewrite this answer with a more confident, assertive tone — own the achievements, remove hedging.",
  professional: "Rewrite this answer in a more polished, professional tone.",
  resumeTone:
    "Rewrite this answer so its wording and tone align with the candidate's resume: same terminology, same seniority level, consistent claims.",
} as const;

export type RevisionAction = keyof typeof REVISION_ACTIONS;

const revisionSchema = jsonSchema<{ answer: string }>({
  type: "object",
  properties: {
    answer: { type: "string", description: "The revised answer, plain text." },
  },
  required: ["answer"],
  additionalProperties: false,
});

export async function reviseInterviewAnswer(
  question: string,
  answer: string,
  action: RevisionAction,
  evidence: InterviewEvidence,
  model: LanguageModel
): Promise<string> {
  const { object } = await generateObject({
    model,
    schema: revisionSchema,
    system: [
      "You are an interview coach revising a candidate's saved interview answer. Revise ONLY as instructed — keep everything else.",
      `Instruction: ${REVISION_ACTIONS[action]}`,
      "HARD RULE: never add experience, employers, tools, or numbers that are not in the original answer or the evidence.",
    ].join("\n"),
    prompt: [
      `Interview question: ${question}`,
      "",
      "Current answer:",
      answer,
      "",
      "Candidate evidence (for reference, do not import new claims unless the instruction requires expansion):",
      (evidence.digest || "(none)").slice(0, 6000),
    ].join("\n"),
    maxOutputTokens: 1000,
  });
  return object.answer.trim();
}
