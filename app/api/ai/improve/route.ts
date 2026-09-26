import { streamText } from "ai";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Section-specific system prompts. Each is told to return ONLY the rewritten
// content (no preamble, no markdown fences) so the result can drop straight
// back into the editor.
// The summary and highlights are stored as constrained HTML, so those prompts
// ask for the same markup back (paragraphs/lists and bold/italic emphasis kept
// on phrases that survive the rewrite). The client sanitizes whatever comes
// back, so a plain-text answer still works — it just loses no more than it had.
const SYSTEM_PROMPTS: Record<string, string> = {
  summary:
    "You are a professional resume writer. The input is the candidate's professional summary as constrained HTML: <p> paragraphs, optional <ul>/<ol> lists with <li> items, and inline <strong>, <em>, <u>, <s> emphasis (it may also be plain text). Rewrite it so it is concise (2-3 sentences, or a similarly short structure if the input uses a list), uses active voice and strong verbs, leads with seniority/role and core strengths, and quantifies impact where the input allows. Do not invent facts. Return the rewritten summary as the SAME constrained HTML: keep paragraphs as <p>, keep lists as <ul>/<ol> with <li>, and keep the existing <strong>/<em>/<u>/<s> emphasis on the phrases that survive the rewrite (do not add new emphasis). If the input was plain text, return plain text with a blank line between paragraphs. No other tags, no markdown, no code fences, no preamble — return ONLY the rewritten summary.",
  highlights:
    "You are a professional resume writer. The input is a list of work-experience bullet points, one per line; a line may contain inline HTML emphasis (<strong>, <em>, <u>, <s>). Rewrite each as a strong achievement using the pattern: action verb + what you did + measurable impact. Keep one bullet per line, in the same order, with a similar count to the input; no leading dashes, numbering, or list tags. Keep the existing emphasis tags on the phrases that survive the rewrite and do not add new ones. Do not invent metrics that aren't implied. No other tags, no markdown, no code fences — return ONLY the rewritten bullets, one per line.",
  generic:
    "You are a professional resume writer. Improve the following resume text for clarity, impact, and professionalism without inventing facts. Return ONLY the improved text.",
};

export async function POST(req: Request) {
  const { sectionType, text } = await req.json().catch(() => ({}));

  if (typeof text !== "string" || !text.trim()) {
    return new Response("Nothing to improve — the section is empty.", {
      status: 400,
    });
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return new Response(access.message, { status: access.status });
  }
  const { usingUserKey } = access;

  const system =
    SYSTEM_PROMPTS[sectionType as string] ?? SYSTEM_PROMPTS.generic;

  try {
    const result = streamText({
      model: openrouterModel(access.apiKey, access.model),
      system,
      prompt: text,
      maxOutputTokens: 800,
      onError({ error }) {
        // If the shared credit is exhausted, email the owner (deduped).
        if (!usingUserKey && isCreditsError(error)) {
          void notifyOwnerCreditsExhausted(
            error instanceof Error ? error.message : String(error)
          );
        }
        console.error("ai/improve stream error:", error);
      },
    });
    return result.toTextStreamResponse();
  } catch (err) {
    if (!usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(
        err instanceof Error ? err.message : String(err)
      );
    }
    const message = err instanceof Error ? err.message : "AI request failed.";
    return new Response(message, { status: 502 });
  }
}
