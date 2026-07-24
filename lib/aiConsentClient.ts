"use client";

// Client side of the AI data-sharing consent gate (App Store guideline
// 5.1.2(i)). Components never call AI endpoints with plain fetch — they use
// aiFetch below, which makes sure the user has explicitly allowed sending
// resume/job text to the AI provider before any request is made. The consent
// dialog itself is rendered by components/AiConsentHost.tsx (mounted once in
// Providers) and registered here.

type ConsentPrompt = (resolve: (allowed: boolean) => void) => void;

let prompt: ConsentPrompt | null = null;
let declinedMessage = "AI request cancelled — no data was sent.";
let consented: boolean | null = null; // per-page-load cache of server status
let pending: Promise<boolean> | null = null;

export function registerConsentHost(
  fn: ConsentPrompt,
  localizedDeclinedMessage: string
): () => void {
  prompt = fn;
  declinedMessage = localizedDeclinedMessage;
  return () => {
    if (prompt === fn) prompt = null;
  };
}

async function resolveConsent(): Promise<boolean> {
  // Server-recorded status first (consent follows the account across devices).
  try {
    const res = await fetch("/api/ai/consent");
    if (res.ok && (await res.json())?.consented) {
      consented = true;
      return true;
    }
  } catch {
    // Status unreadable — fall through to asking; the server enforces anyway.
  }

  // No host mounted (shouldn't happen): let the request through — the server
  // refuses unconsented AI calls with a readable message.
  if (!prompt) return true;

  const allowed = await new Promise<boolean>((resolve) => prompt!(resolve));
  if (!allowed) return false;

  const res = await fetch("/api/ai/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consented: true }),
  });
  if (!res.ok) return false;
  consented = true;
  return true;
}

// Returns once the user has granted AI consent (possibly after showing the
// dialog); false when they declined. Concurrent callers share one dialog.
export async function ensureAiConsent(): Promise<boolean> {
  if (consented) return true;
  if (!pending) {
    pending = resolveConsent().finally(() => {
      pending = null;
    });
  }
  return pending;
}

// Drop-in replacement for fetch() on AI endpoints. When the user declines,
// no request is made and a synthetic 403 response is returned whose JSON
// {error} message flows through the components' existing error handling.
export async function aiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const ok = await ensureAiConsent();
  if (!ok) {
    return new Response(JSON.stringify({ error: declinedMessage }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return fetch(input, init);
}
