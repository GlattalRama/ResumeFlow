import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  loadSettings,
  decryptApiKey,
  checkAndBumpDailyUsage,
  DEFAULT_MODEL,
  DAILY_LIMIT,
} from "@/lib/aiSettings";
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

  const settings = await loadSettings();
  const userKey = decryptApiKey(settings); // BYOK power users
  const appKey = process.env.OPENROUTER_API_KEY; // shared, app-provided

  // Prefer the user's own key (unlimited, their bill); otherwise fall back to
  // the shared app key (metered by a per-user daily cap).
  const usingUserKey = !!userKey;
  const apiKey = userKey || appKey;
  if (!apiKey) {
    return new Response(
      "AI suggestions aren't available right now. Please try again later.",
      { status: 503 }
    );
  }

  if (!usingUserKey) {
    const cap = await checkAndBumpDailyUsage(DAILY_LIMIT);
    if (!cap.ok) {
      return new Response(
        `You've used today's ${DAILY_LIMIT} free AI suggestions. They reset tomorrow — or add your own API key in Settings for unlimited use.`,
        { status: 429 }
      );
    }
  }

  const system =
    SYSTEM_PROMPTS[sectionType as string] ?? SYSTEM_PROMPTS.generic;
  // With the shared key we control the model; BYOK users pick their own.
  const model = usingUserKey
    ? settings?.model || DEFAULT_MODEL
    : DEFAULT_MODEL;

  try {
    const openrouter = createOpenRouter({ apiKey });
    const result = streamText({
      model: openrouter.chat(model),
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
