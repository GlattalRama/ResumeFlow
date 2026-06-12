// AI actions over a single Work Journal note: resume bullets, wording
// improvement, and STAR story generation.
//
// All three are evidence-bound: the prompt is built ONLY from the note's own
// fields and the system prompts forbid inventing employers, tools, or metrics.
// Results are returned to the client for review — nothing here persists; the
// user accepts (or rejects) and the client saves via the journal PATCH API.
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import type { WorkJournalNote } from "./types";

export type WorkJournalAiAction = "bullets" | "improve" | "star";

function noteDigest(n: WorkJournalNote): string {
  const lines = [
    `Title: ${n.title}`,
    n.role && `Role: ${n.role}`,
    n.company && `Company: ${n.company}`,
    n.client && `Client: ${n.client}`,
    n.project && `Project: ${n.project}`,
    n.period && `Period: ${n.period}`,
    n.whatIDid && `What I did: ${n.whatIDid}`,
    n.toolsTechnologies && `Tools/technologies: ${n.toolsTechnologies}`,
    n.problemSolved && `Problem solved: ${n.problemSolved}`,
    n.impactResult && `Impact/result: ${n.impactResult}`,
    n.metrics && `Metrics: ${n.metrics}`,
  ];
  return lines.filter(Boolean).join("\n");
}

const EVIDENCE_RULE =
  "Hard rule: use ONLY facts present in the note. Never invent employers, clients, tools, numbers, or outcomes. If the note has no metrics, describe impact qualitatively — do not fabricate figures.";

const bulletsSchema = jsonSchema<{ bullets: string[] }>({
  type: "object",
  properties: {
    bullets: {
      type: "array",
      items: { type: "string" },
      description:
        "3-5 resume bullet points, each a single line of plain text with no leading dash or numbering.",
    },
  },
  required: ["bullets"],
  additionalProperties: false,
});

export async function generateBulletsFromNote(
  note: WorkJournalNote,
  model: LanguageModel
): Promise<string[]> {
  const { object } = await generateObject({
    model,
    schema: bulletsSchema,
    system: [
      "You are a professional resume writer. Turn the work journal note below into 3-5 strong resume bullet points.",
      "Each bullet: action verb + what was done + measurable or concrete impact. Past tense, no first person, no fluff.",
      EVIDENCE_RULE,
    ].join("\n"),
    prompt: noteDigest(note),
    maxOutputTokens: 600,
  });
  return object.bullets.map((b) => b.trim()).filter(Boolean);
}

const improveSchema = jsonSchema<{
  whatIDid: string;
  problemSolved: string;
  impactResult: string;
}>({
  type: "object",
  properties: {
    whatIDid: { type: "string" },
    problemSolved: { type: "string" },
    impactResult: { type: "string" },
  },
  required: ["whatIDid", "problemSolved", "impactResult"],
  additionalProperties: false,
});

export async function improveNoteWording(
  note: WorkJournalNote,
  model: LanguageModel
): Promise<{ whatIDid: string; problemSolved: string; impactResult: string }> {
  const { object } = await generateObject({
    model,
    schema: improveSchema,
    system: [
      "You are a professional writing coach. Improve the wording of the three prose fields of this work journal note (whatIDid, problemSolved, impactResult): clearer, more specific, professional, active voice.",
      "Keep every fact, tool name, and figure exactly as given. Return a field as an empty string if it was empty in the input.",
      EVIDENCE_RULE,
    ].join("\n"),
    prompt: noteDigest(note),
    maxOutputTokens: 800,
  });
  return {
    whatIDid: note.whatIDid ? object.whatIDid.trim() : "",
    problemSolved: note.problemSolved ? object.problemSolved.trim() : "",
    impactResult: note.impactResult ? object.impactResult.trim() : "",
  };
}

const starSchema = jsonSchema<{
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

export interface StarStory {
  situation: string;
  task: string;
  action: string;
  result: string;
}

export async function generateStarFromNote(
  note: WorkJournalNote,
  model: LanguageModel
): Promise<StarStory> {
  const { object } = await generateObject({
    model,
    schema: starSchema,
    system: [
      "You are an interview coach. Turn the work journal note below into a STAR story the candidate can tell in an interview: Situation, Task, Action, Result — each 1-3 sentences, first person, conversational but professional.",
      EVIDENCE_RULE,
    ].join("\n"),
    prompt: noteDigest(note),
    maxOutputTokens: 700,
  });
  return {
    situation: object.situation.trim(),
    task: object.task.trim(),
    action: object.action.trim(),
    result: object.result.trim(),
  };
}

export function formatStarStory(s: StarStory): string {
  return [
    `Situation: ${s.situation}`,
    `Task: ${s.task}`,
    `Action: ${s.action}`,
    `Result: ${s.result}`,
  ].join("\n\n");
}
