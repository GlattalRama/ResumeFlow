import { NextResponse } from "next/server";
import { loadSettings, saveSettings, maskKey } from "@/lib/aiSettings";
import type { AiProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

// Return the non-sensitive parts of the user's AI settings. The API key is
// NEVER returned — only a boolean + a masked preview so the UI can show that a
// key is configured.
export async function GET() {
  const s = await loadSettings();
  return NextResponse.json({
    provider: s?.provider ?? "openrouter",
    model: s?.model ?? "openai/gpt-4o-mini",
    hasKey: !!s?.apiKeyEnc,
    maskedKey: maskKey(s),
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
