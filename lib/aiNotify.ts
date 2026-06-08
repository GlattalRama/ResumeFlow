// Owner notification when the shared (app-provided) AI credit is exhausted.
//
// Detection: OpenRouter/OpenAI return HTTP 402 ("insufficient credits" /
// "payment required") once the prepaid balance hits zero. We email the owner
// once it happens. Dedupe is best-effort and per-instance (a module-level
// timestamp) so a burst of failed calls doesn't send a burst of emails — good
// enough for a rare, terminal condition.
import { APICallError } from "ai";

const OWNER_EMAIL = process.env.OWNER_EMAIL || "devteamprayaga@gmail.com";
const DEDUPE_MS = 6 * 60 * 60 * 1000; // at most one email per 6h per instance
let lastNotified = 0;

// True when the error looks like "out of credits / payment required" rather
// than a transient or auth error.
export function isCreditsError(error: unknown): boolean {
  let statusCode: number | undefined;
  let body = "";
  if (APICallError.isInstance(error)) {
    statusCode = error.statusCode;
    body = `${error.message} ${error.responseBody ?? ""}`;
  } else if (error instanceof Error) {
    body = error.message;
  }
  const text = body.toLowerCase();
  return (
    statusCode === 402 ||
    /insufficient|out of credit|payment required|quota|exceeded your/.test(text)
  );
}

// Fire-and-forget email to the owner via Resend's HTTP API (no SDK dependency).
// Requires RESEND_API_KEY. Without it, we log a distinct line you can alert on.
export async function notifyOwnerCreditsExhausted(detail: string): Promise<void> {
  const now = Date.now();
  if (now - lastNotified < DEDUPE_MS) return;
  lastNotified = now;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      `AI_CREDIT_EXHAUSTED (set RESEND_API_KEY to get emailed): ${detail}`
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ResumeFlow <onboarding@resend.dev>",
        to: OWNER_EMAIL,
        subject: "⚠️ ResumeFlow: AI credit exhausted",
        text:
          "The shared AI credit for ResumeFlow's 'Improve with AI' feature appears to be exhausted, " +
          "so suggestions are temporarily unavailable for users.\n\n" +
          `Provider error: ${detail}\n\n` +
          "Top up your balance at https://openrouter.ai/credits to restore it.",
      }),
    });
    if (!res.ok) {
      console.error(
        `AI_CREDIT_EXHAUSTED email failed (${res.status}): ${await res.text()}`
      );
    }
  } catch (err) {
    console.error("AI_CREDIT_EXHAUSTED email threw:", err);
  }
}
