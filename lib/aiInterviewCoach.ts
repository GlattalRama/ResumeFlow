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
import { starFromLegacy } from "./career/migrate";
import { INTERVIEW_QUESTION_CATEGORIES } from "./constants";
import type {
  Application,
  InterviewAnswerFormat,
  InterviewAnswerTone,
  InterviewQuestionCategory,
  Note,
  PracticeFeedback,
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
  // Titles of the Work Journal stories included in the digest, in priority
  // order — used to attribute which STAR stories an answer was built from.
  journalTitles: string[];
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

// "technical-delivery" → "Technical Delivery" for readable prompt evidence.
function humanizeCategory(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function hasStarContent(n: WorkJournalNote): boolean {
  const s = n.star;
  return !!s && Boolean(s.situation || s.task || s.action || s.result);
}

// Strongest evidence first: resume-ready, then entries with a real STAR story,
// then most recently updated. Capped to keep the prompt focused.
function pickJournalNotes(notes: WorkJournalNote[]): WorkJournalNote[] {
  return [...notes]
    .sort((a, b) => {
      if (a.resumeReady !== b.resumeReady) return a.resumeReady ? -1 : 1;
      if (hasStarContent(a) !== hasStarContent(b)) return hasStarContent(a) ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 12);
}

function journalLines(picked: WorkJournalNote[]): string[] {
  if (picked.length === 0) return [];
  const lines = ["## Work Journal (the candidate's own captured STAR stories)"];
  for (const n of picked) {
    const meta = [n.role, n.company, n.project, n.period].filter(Boolean).join(", ");
    const cat = n.category ? ` [${humanizeCategory(n.category)}]` : "";
    lines.push(`Story "${n.title}"${meta ? ` (${meta})` : ""}${cat}:`);
    // Prefer the structured STAR; derive it from the legacy prose for entries
    // captured before STAR-native capture so older notes still read as STAR.
    const star = hasStarContent(n) ? n.star! : starFromLegacy(n);
    if (star.situation) lines.push(`  Situation: ${star.situation}`);
    if (star.task) lines.push(`  Task: ${star.task}`);
    if (star.action) lines.push(`  Action: ${star.action}`);
    if (star.result) lines.push(`  Result: ${star.result}`);
    if (n.metrics) lines.push(`  Metrics: ${n.metrics}`);
    if (n.toolsTechnologies) lines.push(`  Tools: ${n.toolsTechnologies}`);
    if (n.tags.length > 0) lines.push(`  Tags: ${n.tags.join(", ")}`);
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
  const journalPicked = pickJournalNotes(opts.journalNotes);
  const journal = journalLines(journalPicked);
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
    journalTitles: journalPicked.map((n) => n.title).filter(Boolean),
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
  // Exact Work Journal story titles the answer was built from (validated
  // against the titles that were actually provided to the model).
  storiesUsed: string[];
}

const answerSchema = jsonSchema<{
  answer: string;
  evidenceUsed: string[];
  gaps: string[];
  storiesUsed: string[];
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
    storiesUsed: {
      type: "array",
      items: { type: "string" },
      description:
        "Exact titles, copied verbatim from the provided Work Journal story titles list, of the STAR stories this answer was built from. Empty if none were used.",
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description:
        "What was missing: information the question needs that the evidence doesn't cover, each with a suggestion of what to add to the Work Journal. Empty if nothing was missing.",
    },
  },
  required: ["answer", "evidenceUsed", "gaps", "storiesUsed"],
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
      evidence.journalTitles.length > 0
        ? `Work Journal story titles available (copy verbatim into storiesUsed for any you build on): ${evidence.journalTitles
            .map((t) => `"${t}"`)
            .join(", ")}`
        : "",
      "",
      "Candidate evidence:",
      evidence.digest || "(none provided)",
    ]
      .filter(Boolean)
      .join("\n"),
    maxOutputTokens: 1000,
  });
  // Only trust story titles that actually exist in the evidence we provided —
  // map them back to their canonical casing so the UI shows the real title.
  const canonical = new Map(evidence.journalTitles.map((t) => [t.toLowerCase(), t]));
  const storiesUsed = [
    ...new Set(object.storiesUsed.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  ]
    .map((lower) => canonical.get(lower))
    .filter((t): t is string => !!t);
  return {
    answer: object.answer.trim(),
    evidenceUsed: object.evidenceUsed.map((e) => e.trim()).filter(Boolean),
    gaps: object.gaps.map((g) => g.trim()).filter(Boolean),
    storiesUsed,
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

// ---- Practice answer grading (Review / Practice / Repeat) -------------------

type PracticeFeedbackCore = Omit<PracticeFeedback, "gradedAt">;

const practiceSchema = jsonSchema<PracticeFeedbackCore>({
  type: "object",
  properties: {
    overall: { type: "number", description: "Overall answer quality, 0-10." },
    clarity: { type: "number", description: "0-10." },
    relevance: { type: "number", description: "0-10: how well it answers the question." },
    structure: { type: "number", description: "0-10." },
    starQuality: { type: "number", description: "0-10: STAR structure quality (situation/task/action/result)." },
    confidence: { type: "number", description: "0-10: how confident/assured it reads." },
    technicalAccuracy: {
      type: "number",
      description: "0-10 technical correctness for technical questions; use 0 for non-technical questions.",
    },
    goodPoints: { type: "array", items: { type: "string" }, description: "What the answer did well." },
    improvementPoints: { type: "array", items: { type: "string" }, description: "What to improve." },
    missingPoints: { type: "array", items: { type: "string" }, description: "Key points the answer missed." },
    suggestedAnswer: {
      type: "string",
      description: "A stronger version of the answer, grounded only in the evidence. The user must accept it before it's used.",
    },
    matched: {
      type: "object",
      properties: {
        baseResume: { type: "boolean" },
        workJournal: { type: "boolean" },
        selectedResume: { type: "boolean" },
        application: { type: "boolean" },
        jobDescription: { type: "boolean" },
      },
      required: ["baseResume", "workJournal", "selectedResume", "application", "jobDescription"],
      additionalProperties: false,
      description: "Whether the answer aligned with each evidence source.",
    },
    journalEvidenceToStrengthen: {
      type: "array",
      items: { type: "string" },
      description: "Work Journal evidence (by topic/title) that would strengthen the answer.",
    },
  },
  // Strict structured-output mode (Azure/OpenAI) requires EVERY property to be
  // listed here. technicalAccuracy is always returned (0 when not applicable)
  // and surfaced only for technical questions.
  required: [
    "overall", "clarity", "relevance", "structure", "starQuality", "confidence",
    "technicalAccuracy", "goodPoints", "improvementPoints", "missingPoints",
    "suggestedAnswer", "matched", "journalEvidenceToStrengthen",
  ],
  additionalProperties: false,
});

const clampScore = (n: number) => Math.max(0, Math.min(10, Math.round(n)));

// Grade a single practice answer against the candidate's own evidence. Returns
// feedback for review — never mutates the saved answer.
export async function gradePracticeAnswer(
  question: string,
  practiceAnswer: string,
  isTechnical: boolean,
  evidence: InterviewEvidence,
  model: LanguageModel
): Promise<PracticeFeedbackCore> {
  const { object } = await generateObject({
    model,
    schema: practiceSchema,
    system: [
      "You are an interview coach grading a candidate's PRACTICE answer to an interview question. Score each dimension 0-10 and give specific, actionable feedback.",
      isTechnical
        ? "This is a technical question — score technicalAccuracy 0-10."
        : "This is not a technical question — set technicalAccuracy to 0.",
      "Set each 'matched' flag based on whether the answer's claims align with that evidence source. Suggest a stronger answer grounded ONLY in the evidence — never invent employers, tools, or numbers. List Work Journal evidence that would strengthen it.",
      GROUNDING_RULES,
    ].join("\n"),
    prompt: [
      `Interview question: ${question}`,
      "",
      "Candidate's practice answer:",
      practiceAnswer || "(empty)",
      "",
      "Candidate evidence:",
      evidence.digest || "(none provided)",
    ].join("\n"),
    maxOutputTokens: 1100,
  });
  const o = object as PracticeFeedbackCore;
  return {
    overall: clampScore(o.overall),
    clarity: clampScore(o.clarity),
    relevance: clampScore(o.relevance),
    structure: clampScore(o.structure),
    starQuality: clampScore(o.starQuality),
    confidence: clampScore(o.confidence),
    technicalAccuracy:
      isTechnical && typeof o.technicalAccuracy === "number"
        ? clampScore(o.technicalAccuracy)
        : undefined,
    goodPoints: (o.goodPoints || []).map((s) => s.trim()).filter(Boolean),
    improvementPoints: (o.improvementPoints || []).map((s) => s.trim()).filter(Boolean),
    missingPoints: (o.missingPoints || []).map((s) => s.trim()).filter(Boolean),
    suggestedAnswer: (o.suggestedAnswer || "").trim(),
    matched: {
      baseResume: !!o.matched?.baseResume,
      workJournal: !!o.matched?.workJournal,
      selectedResume: !!o.matched?.selectedResume,
      application: !!o.matched?.application,
      jobDescription: !!o.matched?.jobDescription,
    },
    journalEvidenceToStrengthen: (o.journalEvidenceToStrengthen || [])
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
