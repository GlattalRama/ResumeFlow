// Server-only helpers for the user's AI (BYOK) settings singleton.
// The settings live in the user's Google Drive appData (or /data in local
// mode) as a one-element collection. The API key is stored encrypted and only
// ever decrypted transiently, server-side, at call time.
import { readAll, writeAll } from "./store";
import { encrypt, decrypt } from "./crypto";
import {
  readTemplateVisibility,
  writeTemplateVisibility,
} from "./adminTemplates/store";
import type { CareerInsights, PromotionReadiness, UserSettings, AiProvider } from "./types";

const SINGLETON = "singleton";

// Default model used with the shared app key (cheap + good enough for resume
// edits). Overridable via the AI_MODEL env var.
export const DEFAULT_MODEL = process.env.AI_MODEL || "openai/gpt-4o-mini";

// Per-user daily cap on the shared key (BYOK users aren't metered).
export const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || "30");

function utcDay(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export async function loadSettings(): Promise<UserSettings | null> {
  const all = await readAll("settings");
  return all.find((s) => s.id === SINGLETON) ?? all[0] ?? null;
}

// Single writer for the settings singleton: load the current record, apply a
// partial patch, and write it back. Going through one merge point means a write
// that only cares about one field (e.g. usage or baseResumeId) can never drop
// the others — the failure mode that previously lost fields on partial writes.
async function patchSettings(
  patch: Partial<Omit<UserSettings, "id" | "updatedAt">>
): Promise<UserSettings> {
  const s = await loadSettings();
  const merged: UserSettings = {
    id: SINGLETON,
    provider: s?.provider ?? "openrouter",
    model: s?.model ?? DEFAULT_MODEL,
    apiKeyEnc: s?.apiKeyEnc ?? "",
    usage: s?.usage,
    baseResumeId: s?.baseResumeId,
    careerInsights: s?.careerInsights,
    promotionReadiness: s?.promotionReadiness,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeAll("settings", [merged]);
  return merged;
}

// Persist the cached career insights, preserving all other settings.
export async function setCareerInsights(insights: CareerInsights): Promise<void> {
  await patchSettings({ careerInsights: insights });
}

// Persist the cached promotion-readiness assessment, preserving other settings.
export async function setPromotionReadiness(readiness: PromotionReadiness): Promise<void> {
  await patchSettings({ promotionReadiness: readiness });
}

// Persist provider/model, and the API key only when a new one is supplied
// (an empty/omitted apiKey keeps the existing encrypted key untouched).
export async function saveSettings(input: {
  provider: AiProvider;
  model: string;
  apiKey?: string;
}): Promise<void> {
  const patch: Partial<UserSettings> = {
    provider: input.provider,
    model: input.model,
  };
  // Only overwrite the stored key when a new one is supplied.
  if (input.apiKey) patch.apiKeyEnc = encrypt(input.apiKey);
  await patchSettings(patch);
}

// Set or clear the Base Resume pointer, preserving all other settings. Pass null
// to clear it (e.g. when the designated base resume is deleted).
export async function setBaseResumeId(id: string | null): Promise<void> {
  await patchSettings({ baseResumeId: id ?? undefined });
}

// Read the admin template-visibility overrides map (empty when none set).
//
// This is an APP-GLOBAL admin setting, so it is read from the shared store
// (lib/adminTemplates/store.ts) — NOT the per-user settings singleton, which
// lives in the caller's own Google Drive and would scope the override to a
// single account.
export async function loadTemplateVisibility(): Promise<
  Record<string, boolean>
> {
  return readTemplateVisibility();
}

// Persist the admin template-visibility overrides map to the shared global
// store. The map is keyed by TemplateId; true = visible, false = hidden.
export async function setTemplateVisibility(
  overrides: Record<string, boolean>
): Promise<void> {
  await writeTemplateVisibility(overrides);
}

// Enforce + increment the per-user daily limit on the shared key. Returns
// whether the call is allowed and how many remain today. Counts reset at UTC
// midnight. Increments optimistically before the AI call (a failed call still
// counts — acceptable for a generous limit).
export async function checkAndBumpDailyUsage(
  limit: number
): Promise<{ ok: boolean; remaining: number }> {
  const s = await loadSettings();
  const today = utcDay();
  const current =
    s?.usage && s.usage.day === today ? s.usage.count : 0;

  if (current >= limit) return { ok: false, remaining: 0 };

  const next = { day: today, count: current + 1 };
  await patchSettings({ usage: next });
  return { ok: true, remaining: limit - next.count };
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
