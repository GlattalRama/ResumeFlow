import { NextResponse } from "next/server";
import {
  loadSettings,
  saveSettings,
  maskKey,
  DEFAULT_MODEL,
  DAILY_LIMIT,
} from "@/lib/aiSettings";
import type { AiProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

// Return the non-sensitive parts of the user's AI settings. The API key is
// NEVER returned — only a boolean + a masked preview so the UI can show that a
// key is configured.
export async function GET() {
  const s = await loadSettings();
  const today = new Date().toISOString().slice(0, 10);
  const usedToday =
    s?.usage && s.usage.day === today ? s.usage.count : 0;
  return NextResponse.json({
    provider: s?.provider ?? "openrouter",
    model: s?.model ?? DEFAULT_MODEL,
    hasKey: !!s?.apiKeyEnc,
    maskedKey: maskKey(s),
    // Whether the app provides a shared key, so AI works with zero setup.
    builtInAvailable: !!process.env.OPENROUTER_API_KEY,
    dailyLimit: DAILY_LIMIT,
    usedToday,
  });
}

// Save provider + model, and (only if provided) a new API key. Omitting apiKey
// keeps the existing key — so the client never has to round-trip the secret.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider: AiProvider = "openrouter"; // single provider for now
  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim()
    : "openai/gpt-4o-mini";
  const apiKey =
    typeof body.apiKey === "string" && body.apiKey.trim()
      ? body.apiKey.trim()
      : undefined;

  await saveSettings({ provider, model, apiKey });
  return NextResponse.json({ ok: true });
}
