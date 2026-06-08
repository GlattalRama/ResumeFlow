// Server-only helpers for the user's AI (BYOK) settings singleton.
// The settings live in the user's Google Drive appData (or /data in local
// mode) as a one-element collection. The API key is stored encrypted and only
// ever decrypted transiently, server-side, at call time.
import { readAll, writeAll } from "./store";
import { encrypt, decrypt } from "./crypto";
import type { UserSettings, AiProvider } from "./types";

const SINGLETON = "singleton";

export async function loadSettings(): Promise<UserSettings | null> {
  const all = await readAll("settings");
  return all.find((s) => s.id === SINGLETON) ?? all[0] ?? null;
}

// Persist provider/model, and the API key only when a new one is supplied
// (an empty/omitted apiKey keeps the existing encrypted key untouched).
export async function saveSettings(input: {
  provider: AiProvider;
  model: string;
  apiKey?: string;
}): Promise<void> {
  const existing = await loadSettings();
  const apiKeyEnc = input.apiKey
    ? encrypt(input.apiKey)
    : existing?.apiKeyEnc ?? "";
  await writeAll("settings", [
    {
      id: SINGLETON,
      provider: input.provider,
      model: input.model,
      apiKeyEnc,
      updatedAt: new Date().toISOString(),
    },
  ]);
}

// Decrypt the stored API key. Returns null when none is configured or the
// ciphertext can't be decrypted (e.g. AUTH_SECRET changed).
export function decryptApiKey(s: UserSettings | null): string | null {
  if (!s?.apiKeyEnc) return null;
  try {
    return decrypt(s.apiKeyEnc);
  } catch {
    return null;
  }
}

// Mask a key for display: sk-or-v1-...last4. Never returns the full key.
export function maskKey(s: UserSettings | null): string | null {
  const key = decryptApiKey(s);
  if (!key) return null;
  const last4 = key.slice(-4);
  return `${key.slice(0, Math.min(8, key.length - 4))}…${last4}`;
}
