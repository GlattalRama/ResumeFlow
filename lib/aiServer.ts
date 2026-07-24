// Shared server-side AI access resolution.
//
// Both the resume "Improve with AI" endpoint and the application "AI assistant"
// actions need the same decision: prefer the user's own (BYOK) OpenRouter key —
// unlimited, their bill — and otherwise fall back to the shared app key, which
// is metered by a per-user daily cap. This module centralizes that logic so the
// two routes can't drift apart.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  loadSettings,
  decryptApiKey,
  checkAndBumpDailyUsage,
  DEFAULT_MODEL,
  DAILY_LIMIT,
} from "./aiSettings";
import { isNativeIOSRequest } from "./nativeApp";

export type AiAccess =
  | { ok: true; apiKey: string; model: string; usingUserKey: boolean }
  | { ok: false; status: number; message: string };

// Resolve the key + model to use for one AI call and enforce the daily cap.
// On the shared key this increments today's usage counter (see
// checkAndBumpDailyUsage). BYOK callers are never metered.
export async function resolveAiAccess(): Promise<AiAccess> {
  const settings = await loadSettings();

  // Server-side backstop for the in-app AI consent gate (App Store guideline
  // 5.1.2(i)): resume/job text may only be sent to the third-party AI provider
  // after the user has explicitly agreed. The client normally obtains consent
  // via the AiConsentHost dialog before ever calling an AI endpoint.
  if (!settings?.aiConsentAt) {
    return {
      ok: false,
      status: 403,
      message:
        "AI features need your permission first: they send the relevant resume " +
        "and job text to our AI provider (OpenRouter). Please try the action " +
        "again and choose Allow in the consent dialog.",
    };
  }

  const userKey = decryptApiKey(settings); // BYOK power users
  const appKey = process.env.OPENROUTER_API_KEY; // shared, app-provided

  const usingUserKey = !!userKey;
  const apiKey = userKey || appKey;
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      message:
        "AI suggestions aren't available right now. Please try again later.",
    };
  }

  if (!usingUserKey) {
    const cap = await checkAndBumpDailyUsage(DAILY_LIMIT);
    if (!cap.ok) {
      // The BYOK suggestion is omitted on iOS, where that option is hidden
      // (App Store guideline 3.1.1 — externally billed services read as
      // out-of-app purchases).
      const byokHint = (await isNativeIOSRequest())
        ? ""
        : " — or add your own API key in Settings for unlimited use";
      return {
        ok: false,
        status: 429,
        message: `You've used today's ${DAILY_LIMIT} free AI suggestions. They reset tomorrow${byokHint}.`,
      };
    }
  }

  // With the shared key we control the model; BYOK users pick their own.
  const model = usingUserKey ? settings?.model || DEFAULT_MODEL : DEFAULT_MODEL;
  return { ok: true, apiKey, model, usingUserKey };
}

// Build an OpenRouter chat model handle for the AI SDK.
export function openrouterModel(apiKey: string, model: string) {
  return createOpenRouter({ apiKey }).chat(model);
}
