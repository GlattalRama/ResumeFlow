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
    return <p className="text-sm text-gray-500">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        ResumeFlow uses <strong>your own</strong> AI key (BYOK). Create a key at{" "}
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
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Provider
        </label>
        <input
          value="OpenRouter"
          disabled
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Model
        </label>
        <input
          list="model-suggestions"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="openai/gpt-4o-mini"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <datalist id="model-suggestions">
          {MODEL_SUGGESTIONS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-gray-400">
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
        <label className="mb-1 block text-sm font-medium text-gray-700">
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
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {hasKey && (
          <p className="mt-1 text-xs text-emerald-600">
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
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {status.kind === "testing" ? "Testing…" : "Test connection"}
        </button>
      </div>

      {status.message && (
        <p
          className={`text-sm ${
            status.kind === "error" ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
