"use client";

import { useEffect, useState } from "react";

// Popular OpenRouter model slugs offered as suggestions. The field is free-text
// so users can paste any slug from openrouter.ai/models.
const MODEL_SUGGESTIONS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "anthropic/claude-3.5-haiku",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
];

export default function SettingsForm() {
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [builtIn, setBuiltIn] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [usedToday, setUsedToday] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    { kind: "idle" | "saving" | "testing" | "ok" | "error"; message?: string }
  >({ kind: "idle" });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.model) setModel(s.model);
        setHasKey(!!s.hasKey);
        setMaskedKey(s.maskedKey ?? null);
        setBuiltIn(!!s.builtInAvailable);
        if (typeof s.dailyLimit === "number") setDailyLimit(s.dailyLimit);
        if (typeof s.usedToday === "number") setUsedToday(s.usedToday);
        if (s.hasKey) setShowAdvanced(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setStatus({ kind: "saving" });
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only send apiKey if the user typed a new one.
      body: JSON.stringify({ model, ...(apiKey.trim() ? { apiKey } : {}) }),
    });
    if (res.ok) {
      setStatus({ kind: "ok", message: "Settings saved." });
      if (apiKey.trim()) {
        setHasKey(true);
        setApiKey("");
        // Refresh the masked preview.
        fetch("/api/settings")
          .then((r) => r.json())
          .then((s) => setMaskedKey(s.maskedKey ?? null))
          .catch(() => {});
      }
    } else {
      setStatus({ kind: "error", message: "Could not save settings." });
    }
  }

  async function test() {
    setStatus({ kind: "testing" });
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, ...(apiKey.trim() ? { apiKey } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      setStatus({
        kind: "ok",
        message: `Connection OK — ${data.model} responded.`,
      });
    } else {
      setStatus({
        kind: "error",
        message: data.error || "Connection failed.",
      });
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      {builtIn ? (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-emerald-900 dark:text-emerald-200">
          <p className="font-medium">✓ AI suggestions are built in — no setup needed.</p>
          <p className="mt-1">
            Open any resume, then click{" "}
            <span className="font-medium">✦ Improve with AI</span> on the
            Summary or a Work Experience entry. You get{" "}
            <strong>{dailyLimit} free suggestions per day</strong>
            {usedToday > 0 ? ` (${usedToday} used today)` : ""}.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200">
          Built-in AI isn’t configured on this deployment yet. You can still use
          AI by adding your own key below.
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          {showAdvanced ? "▾" : "▸"} Advanced: use your own API key (optional)
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          {builtIn
            ? "Optional — only if you want unlimited suggestions on your own account, bypassing the daily limit."
            : "Add a key to enable AI suggestions."}
        </p>
      </div>

      {!showAdvanced ? null : (
      <div className="space-y-6 rounded-lg border border-border p-4">
      <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-900 dark:text-blue-200">
        Bring your <strong>own</strong> AI key (BYOK) for unlimited use on your
        own account. Create a key at{" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer"
          className="font-medium underline"
        >
          openrouter.ai/keys
        </a>{" "}
        — one key works with GPT, Claude, Gemini and more. Usage is billed to
        your OpenRouter account; your key is encrypted and stored in your own
        Google Drive, never on our servers.
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          Provider
        </label>
        <input
          value="OpenRouter"
          disabled
          className="w-full rounded-md border border-input bg-card text-foreground bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          Model
        </label>
        <input
          list="model-suggestions"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="openai/gpt-4o-mini"
          className="w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
        />
        <datalist id="model-suggestions">
          {MODEL_SUGGESTIONS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Any slug from{" "}
          <a
            href="https://openrouter.ai/models"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            openrouter.ai/models
          </a>
          . Cheaper models (e.g. gpt-4o-mini, claude-3.5-haiku) are plenty for
          resume edits.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          OpenRouter API key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            hasKey
              ? `Key saved (${maskedKey ?? "••••"}). Enter a new key to replace.`
              : "sk-or-v1-…"
          }
          autoComplete="off"
          className="w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
        />
        {hasKey && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            ✓ A key is configured. Leave this blank to keep it.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status.kind === "saving"}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={status.kind === "testing"}
          className="rounded-md border border-input bg-card text-foreground bg-card px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/50 disabled:opacity-60"
        >
          {status.kind === "testing" ? "Testing…" : "Test connection"}
        </button>
      </div>

      {status.message && (
        <p
          className={`text-sm ${
            status.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {status.message}
        </p>
      )}
      </div>
      )}
    </div>
  );
}
