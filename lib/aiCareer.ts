// Career Growth System AI helpers (Phase 1):
//   • expandToStar  — "Help Me Write": a rough sentence → a STAR draft + a
//                     suggested category. The user reviews/edits before saving.
//   • polishStar    — tightens an existing STAR draft without changing facts.
//
// Evidence-bound like the rest of the app: prompts may rephrase and structure,
// but must not invent employers, clients, tools, numbers, or outcomes. Nothing
// here persists — results are returned for the user to accept.
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import {
  ACHIEVEMENT_CATEGORIES,
  PROMOTION_DIMENSIONS,
  type AchievementCategory,
  type PromotionDimension,
  type PromotionScore,
  type Star,
  type WorkJournalNote,
} from "./types";

const EVIDENCE_RULE =
  "Hard rule: use ONLY facts present in the user's text. Never invent employers, clients, tools, numbers, or outcomes. If a metric isn't stated, describe impact qualitatively — do not fabricate figures. Leave a STAR field as an empty string if the text gives nothing for it.";

export interface ExpandContext {
  role?: string;
  company?: string;
  client?: string;
  project?: string;
}

function contextLine(c: ExpandContext): string {
  const parts = [
    c.role && `Role: ${c.role}`,
    c.company && `Company: ${c.company}`,
    c.client && `Client: ${c.client}`,
    c.project && `Project: ${c.project}`,
  ].filter(Boolean);
  return parts.length ? `Context (for tone only, do not invent beyond it):\n${parts.join("\n")}\n\n` : "";
}

const expandSchema = jsonSchema<{
  situation: string;
  task: string;
  action: string;
  result: string;
  category: string;
}>({
  type: "object",
  properties: {
    situation: { type: "string", description: "The context — what was happening." },
    task: { type: "string", description: "What the person was responsible for." },
    action: { type: "string", description: "What they specifically did." },
    result: { type: "string", description: "The measurable or concrete outcome." },
    category: {
      type: "string",
      enum: ACHIEVEMENT_CATEGORIES as unknown as string[],
      description: "The single best-fit achievement category slug.",
    },
  },
  required: ["situation", "task", "action", "result", "category"],
  additionalProperties: false,
});

export interface ExpandResult {
  star: Star;
  category: AchievementCategory | "";
}

export async function expandToStar(
  text: string,
  context: ExpandContext,
  model: LanguageModel
): Promise<ExpandResult> {
  const { object } = await generateObject({
    model,
    schema: expandSchema,
    system: [
      "You are a career coach. Turn the user's rough description of something they did at work into a STAR achievement: Situation, Task, Action, Result. Each field 1-3 sentences, first person, professional but natural.",
      "Also pick the single best-fit category from the allowed list.",
      EVIDENCE_RULE,
    ].join("\n"),
    prompt: `${contextLine(context)}What they did:\n${text}`,
    maxOutputTokens: 700,
  });
  const category = (ACHIEVEMENT_CATEGORIES as readonly string[]).includes(object.category)
    ? (object.category as AchievementCategory)
    : "";
  return {
    star: {
      situation: object.situation.trim(),
      task: object.task.trim(),
      action: object.action.trim(),
      result: object.result.trim(),
    },
    category,
  };
}

const polishSchema = jsonSchema<{
  situation: string;
  task: string;
  action: string;
  result: string;
}>({
  type: "object",
  properties: {
    situation: { type: "string" },
    task: { type: "string" },
    action: { type: "string" },
    result: { type: "string" },
  },
  required: ["situation", "task", "action", "result"],
  additionalProperties: false,
});

// ---- Multi-output engine (Phase 3) -----------------------------------------

// Compact, fact-bound digest of an achievement for output generation. Prefers
// structured STAR; falls back to the legacy prose. Includes the real metrics.
function outputsDigest(n: WorkJournalNote): string {
  const star = n.star;
  const lines = [
    `Title: ${n.title}`,
    n.role && `Role: ${n.role}`,
    n.company && `Company: ${n.company}`,
    n.client && `Client: ${n.client}`,
    n.project && `Project: ${n.project}`,
    n.period && `Period: ${n.period}`,
    star?.situation && `Situation: ${star.situation}`,
    star?.task && `Task: ${star.task}`,
    star?.action ? `Action: ${star.action}` : n.whatIDid && `Action: ${n.whatIDid}`,
    star?.result ? `Result: ${star.result}` : n.impactResult && `Result: ${n.impactResult}`,
    n.toolsTechnologies && `Tools/technologies: ${n.toolsTechnologies}`,
    n.metrics && `Metrics: ${n.metrics}`,
  ];
  return lines.filter(Boolean).join("\n");
}

const outputsSchema = jsonSchema<{
  resumeBullet: string;
  starStory: string;
  linkedinPost: string;
  perfReviewBlurb: string;
}>({
  type: "object",
  properties: {
    resumeBullet: {
      type: "string",
      description:
        "One strong resume bullet: action verb + what was done + concrete impact. Past tense, no first person, single line, no leading dash.",
    },
    starStory: {
      type: "string",
      description:
        "A spoken-style STAR interview answer, first person, 4 short labeled parts (Situation / Task / Action / Result).",
    },
    linkedinPost: {
      type: "string",
      description:
        "A short first-person LinkedIn post (2-4 sentences) celebrating the achievement; professional, lightly personable. No hashtags spam (0-2 max).",
    },
    perfReviewBlurb: {
      type: "string",
      description:
        "2-3 sentences for a performance review / promotion packet, in manager-friendly language describing the contribution and its business impact.",
    },
  },
  required: ["resumeBullet", "starStory", "linkedinPost", "perfReviewBlurb"],
  additionalProperties: false,
});

export interface OutputsResult {
  resumeBullet: string;
  starStory: string;
  linkedinPost: string;
  perfReviewBlurb: string;
}

// Generate all four outputs in ONE call (cap-aware — one daily-cap unit).
export async function generateOutputs(
  note: WorkJournalNote,
  model: LanguageModel
): Promise<OutputsResult> {
  const { object } = await generateObject({
    model,
    schema: outputsSchema,
    system: [
      "You turn one captured work achievement into four ready-to-use outputs: a resume bullet, a STAR interview story, a LinkedIn post, and performance-review wording.",
      "Each must be self-contained and immediately usable.",
      EVIDENCE_RULE.replace("user's text", "achievement"),
    ].join("\n"),
    prompt: outputsDigest(note),
    maxOutputTokens: 1100,
  });
  return {
    resumeBullet: object.resumeBullet.trim(),
    starStory: object.starStory.trim(),
    linkedinPost: object.linkedinPost.trim(),
    perfReviewBlurb: object.perfReviewBlurb.trim(),
  };
}

// ---- Career insights (Phase 4) ---------------------------------------------

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Compact collection-level digest: one line per achievement plus a category
// tally, so the model can reason about breadth, strengths, and gaps.
function insightsDigest(notes: WorkJournalNote[]): string {
  const counts = new Map<string, number>();
  const lines: string[] = [];
  for (const n of notes) {
    if (n.category) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    const bits = [
      n.category ? `[${humanize(n.category)}]` : "[uncategorized]",
      n.title,
      n.role && `as ${n.role}`,
      n.metrics && `— ${n.metrics}`,
      n.resumeReady ? "(resume-ready)" : "",
    ].filter(Boolean);
    lines.push(`- ${bits.join(" ")}`);
  }
  const tally = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${humanize(c)}: ${n}`)
    .join(", ");
  return [
    `Total achievements: ${notes.length}`,
    tally ? `By category: ${tally}` : "",
    "",
    "Achievements:",
    ...lines.slice(0, 60),
  ]
    .filter(Boolean)
    .join("\n");
}

const insightsSchema = jsonSchema<{
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}>({
  type: "object",
  properties: {
    summary: { type: "string", description: "1-2 sentence overview of the person's documented career story so far." },
    strengths: { type: "array", items: { type: "string" }, description: "2-4 evidence-backed strengths (e.g. strongest categories, demonstrated skills)." },
    gaps: { type: "array", items: { type: "string" }, description: "2-4 promotion-readiness gaps or thin areas, based on what's missing or sparse." },
    suggestions: { type: "array", items: { type: "string" }, description: "2-4 concrete next achievements or evidence to capture next." },
  },
  required: ["summary", "strengths", "gaps", "suggestions"],
  additionalProperties: false,
});

export interface InsightsResult {
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}

export async function generateInsights(
  notes: WorkJournalNote[],
  model: LanguageModel
): Promise<InsightsResult> {
  const { object } = await generateObject({
    model,
    schema: insightsSchema,
    system: [
      "You are a career coach analyzing someone's work-achievement journal. Give a concise, useful read on their career story: strengths, gaps for promotion readiness, and what to capture next.",
      "Base everything ONLY on the achievements listed. Don't invent accomplishments. Be specific and reference categories/patterns you actually see.",
    ].join("\n"),
    prompt: insightsDigest(notes),
    maxOutputTokens: 700,
  });
  return {
    summary: object.summary.trim(),
    strengths: object.strengths.map((s) => s.trim()).filter(Boolean),
    gaps: object.gaps.map((s) => s.trim()).filter(Boolean),
    suggestions: object.suggestions.map((s) => s.trim()).filter(Boolean),
  };
}

// ---- Promotion readiness (Phase 5) -----------------------------------------

const promotionSchema = jsonSchema<{
  targetLevel: string;
  scores: { dimension: string; score: number; evidenceCount: number; note: string }[];
  recommendations: string[];
}>({
  type: "object",
  properties: {
    targetLevel: {
      type: "string",
      description:
        "The next-level promotion this reads toward, inferred from the seniority in the achievements (e.g. 'Senior → Staff'). Keep it short; use a generic 'next level' if unclear.",
    },
    scores: {
      type: "array",
      description: "One entry per dimension below.",
      items: {
        type: "object",
        properties: {
          dimension: { type: "string", enum: PROMOTION_DIMENSIONS as unknown as string[] },
          score: { type: "number", description: "0-10 readiness for this dimension." },
          evidenceCount: { type: "number", description: "How many achievements support it." },
          note: { type: "string", description: "One short sentence of rationale." },
        },
        required: ["dimension", "score", "evidenceCount", "note"],
        additionalProperties: false,
      },
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "2-4 concrete actions to raise the weakest dimensions.",
    },
  },
  required: ["targetLevel", "scores", "recommendations"],
  additionalProperties: false,
});

export interface PromotionResult {
  targetLevel: string;
  scores: PromotionScore[];
  recommendations: string[];
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(n)));

export async function generatePromotionReadiness(
  notes: WorkJournalNote[],
  model: LanguageModel
): Promise<PromotionResult> {
  const { object } = await generateObject({
    model,
    schema: promotionSchema,
    system: [
      "You assess someone's promotion readiness from their work-achievement journal. Score each dimension 0-10 based ONLY on evidence in the achievements: technical-excellence, leadership, stakeholder-management, delivery, innovation, mentoring, communication.",
      "Be honest and evidence-based — a dimension with no supporting achievements scores low. Then give concrete recommendations to raise the weakest dimensions.",
      "Don't invent achievements. Base evidenceCount on how many listed achievements genuinely support the dimension.",
    ].join("\n"),
    prompt: insightsDigest(notes),
    maxOutputTokens: 900,
  });

  // Normalize: dedupe by dimension, clamp, and ensure all 7 are present so the
  // radar always has a full ring even if the model skips one.
  const byDim = new Map<string, PromotionScore>();
  for (const s of object.scores) {
    if (!(PROMOTION_DIMENSIONS as readonly string[]).includes(s.dimension)) continue;
    const dim = s.dimension as PromotionDimension;
    if (byDim.has(dim)) continue;
    byDim.set(dim, {
      dimension: dim,
      score: clamp(s.score, 0, 10),
      evidenceCount: clamp(s.evidenceCount, 0, notes.length),
      note: (s.note || "").trim(),
    });
  }
  const scores: PromotionScore[] = PROMOTION_DIMENSIONS.map(
    (dim) => byDim.get(dim) ?? { dimension: dim, score: 0, evidenceCount: 0, note: "" }
  );
  return {
    targetLevel: (object.targetLevel || "").trim(),
    scores,
    recommendations: object.recommendations.map((r) => r.trim()).filter(Boolean),
  };
}

export async function polishStar(star: Star, model: LanguageModel): Promise<Star> {
  const { object } = await generateObject({
    model,
    schema: polishSchema,
    system: [
      "You are a professional writing coach. Tighten the wording of this STAR achievement: clearer, more specific, active voice, no fluff.",
      "Keep every fact, tool name, and figure exactly as given. Return a field as an empty string if it was empty in the input.",
      EVIDENCE_RULE,
    ].join("\n"),
    prompt: [
      `Situation: ${star.situation}`,
      `Task: ${star.task}`,
      `Action: ${star.action}`,
      `Result: ${star.result}`,
    ].join("\n"),
    maxOutputTokens: 700,
  });
  // Preserve emptiness: never let polish invent content for a blank field.
  return {
    situation: star.situation ? object.situation.trim() : "",
    task: star.task ? object.task.trim() : "",
    action: star.action ? object.action.trim() : "",
    result: star.result ? object.result.trim() : "",
  };
}
