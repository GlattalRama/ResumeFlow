// Career Growth System AI helpers (Phase 1):
//   • expandToStar  — "Help Me Write": a rough sentence → a STAR draft + a
//                     suggested category. The user reviews/edits before saving.
//   • polishStar    — tightens an existing STAR draft without changing facts.
//
// Evidence-bound like the rest of the app: prompts may rephrase and structure,
// but must not invent employers, clients, tools, numbers, or outcomes. Nothing
// here persists — results are returned for the user to accept.
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import { ACHIEVEMENT_CATEGORIES, type AchievementCategory, type Star } from "./types";

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
