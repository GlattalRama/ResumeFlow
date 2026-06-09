import { streamText } from "ai";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Section-specific system prompts. Each is told to return ONLY the rewritten
// content (no preamble, no markdown fences) so the result can drop straight
// back into the editor.
const SYSTEM_PROMPTS: Record<string, string> = {
  summary:
    "You are a professional resume writer. Rewrite the candidate's professional summary so it is concise (2-3 sentences), uses active voice and strong verbs, leads with seniority/role and core strengths, and quantifies impact where the input allows. The input may contain HTML tags — ignore them and return PLAIN TEXT only. Do not invent facts. Return ONLY the rewritten summary.",
  highlights:
    "You are a professional resume writer. The input is a list of work-experience bullet points, one per line. Rewrite each as a strong achievement using the pattern: action verb + what you did + measurable impact. Keep one bullet per line, no leading dashes or numbering, similar count to the input. Do not invent metrics that aren't implied. Return ONLY the rewritten bullets, one per line.",
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
