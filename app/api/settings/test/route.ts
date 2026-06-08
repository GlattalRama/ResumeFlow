import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { loadSettings, decryptApiKey } from "@/lib/aiSettings";

export const dynamic = "force-dynamic";

// "Test connection" for the settings page: makes one tiny, cheap call with the
// saved (or just-entered) key + model so the user gets immediate feedback that
// their OpenRouter key works.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const s = await loadSettings();
  // Prefer a key typed into the form (not yet saved); fall back to the stored one.
  const apiKey =
    typeof body.apiKey === "string" && body.apiKey.trim()
      ? body.apiKey.trim()
      : decryptApiKey(s);
  const model =
    (typeof body.model === "string" && body.model.trim()) ||
    s?.model ||
    "openai/gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "No API key configured." },
      { status: 400 }
    );
  }

  try {
    const openrouter = createOpenRouter({ apiKey });
    const { text } = await generateText({
      model: openrouter.chat(model),
      prompt: 'Reply with the single word: ok',
      maxOutputTokens: 5,
    });
    return NextResponse.json({ ok: true, model, sample: text.trim() });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Request to OpenRouter failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
