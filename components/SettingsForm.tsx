"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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

// hideByok: the iOS shell hides the bring-your-own-key option (App Store
// guideline 3.1.1 — externally billed services read as out-of-app purchases).
export default function SettingsForm({
  hideByok = false,
}: {
  hideByok?: boolean;
}) {
  const t = useTranslations("settings");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [builtIn, setBuiltIn] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [usedToday, setUsedToday] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiConsent, setAiConsent] = useState<boolean | null>(null);
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
    fetch("/api/ai/consent")
      .then((r) => r.json())
      .then((c) => setAiConsent(!!c.consented))
      .catch(() => {});
  }, []);

  async function updateAiConsent(consented: boolean) {
    setAiConsent(consented);
    try {
      await fetch("/api/ai/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consented }),
      });
    } catch {
      setAiConsent(!consented); // revert on failure
    }
  }

  async function save() {
    setStatus({ kind: "saving" });
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only send apiKey if the user typed a new one.
      body: JSON.stringify({ model, ...(apiKey.trim() ? { apiKey } : {}) }),
    });
    if (res.ok) {
      setStatus({ kind: "ok", message: t("savedOk") });
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
      setStatus({ kind: "error", message: t("saveError") });
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
        message: t("connectionOk", { model: data.model }),
      });
    } else {
      setStatus({
        kind: "error",
        message: data.error || t("connectionFailed"),
      });
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  return (
    <div className="space-y-6">
      {builtIn ? (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-emerald-900 dark:text-emerald-200">
          <p className="font-medium">{t("builtInHeading")}</p>
          <p className="mt-1">
            {t.rich("builtInBody", {
              b: (chunks) => <strong>{chunks}</strong>,
              limit: dailyLimit,
              used: usedToday > 0 ? t("usedToday", { used: usedToday }) : "",
            })}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200">
          {t("notConfigured")}
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">
          {t("aiConsentHeading")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("aiConsentBody")}
        </p>
        {aiConsent !== null && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span
              className={`text-xs font-medium ${
                aiConsent
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {aiConsent ? t("aiConsentOn") : t("aiConsentOff")}
            </span>
            <button
              type="button"
              onClick={() => updateAiConsent(!aiConsent)}
              className="rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted/50"
            >
              {aiConsent ? t("aiConsentWithdraw") : t("aiConsentAllow")}
            </button>
          </div>
        )}
      </div>

      {hideByok ? null : (
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          {showAdvanced ? "▾" : "▸"} {t("advancedToggle")}
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          {builtIn ? t("advancedHintBuiltIn") : t("advancedHintNoKey")}
        </p>
      </div>
      )}

      {!showAdvanced || hideByok ? null : (
      <div className="space-y-6 rounded-lg border border-border p-4">
      <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-900 dark:text-blue-200">
        {t.rich("byokBanner", {
          b: (chunks) => <strong>{chunks}</strong>,
          link: (chunks) => (
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              {chunks}
            </a>
          ),
        })}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          {t("provider")}
        </label>
        <input
          value="OpenRouter"
          disabled
          className="w-full rounded-md border border-input bg-card text-foreground bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          {t("model")}
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
          {t.rich("modelHint", {
            link: (chunks) => (
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          {t("apiKeyLabel")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            hasKey
              ? t("keySavedPlaceholder", { masked: maskedKey ?? "••••" })
              : "sk-or-v1-…"
          }
          autoComplete="off"
          className="w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
        />
        {hasKey && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            {t("keyConfigured")}
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
          {status.kind === "saving" ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={status.kind === "testing"}
          className="rounded-md border border-input bg-card text-foreground bg-card px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/50 disabled:opacity-60"
        >
          {status.kind === "testing" ? t("testing") : t("testConnection")}
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
