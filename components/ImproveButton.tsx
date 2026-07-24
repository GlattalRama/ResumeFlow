"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { aiFetch } from "@/lib/aiConsentClient";

// Per-section "Improve with AI" control. Streams a suggestion from
// /api/ai/improve and shows it as a preview the user can Accept or Discard —
// it never overwrites the resume on its own.
export default function ImproveButton({
  sectionType,
  text,
  onAccept,
}: {
  sectionType: string;
  // Current text of the section (caller decides how to serialize it).
  text: string;
  // Called with the accepted suggestion.
  onAccept: (value: string) => void;
}) {
  const t = useTranslations("ai");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  async function run() {
    setError(null);
    setNeedsKey(false);
    setSuggestion("");

    if (!text.trim()) {
      setError(t("improve.addTextFirst"));
      return;
    }

    setLoading(true);
    try {
      const res = await aiFetch("/api/ai/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType, text }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.text();
        if (res.status === 400 && /key/i.test(msg)) setNeedsKey(true);
        setError(msg || t("improve.requestFailed"));
        return;
      }

      // Stream tokens in so the suggestion types out live.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setSuggestion(acc);
      }
    } catch {
      setError(t("improve.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      {!suggestion && (
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 transition hover:bg-brand-100 dark:hover:bg-brand-500/20 disabled:opacity-60"
        >
          <span aria-hidden>✦</span>
          {loading ? t("improve.thinking") : t("improve.button")}
        </button>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}{" "}
          {needsKey && (
            <Link href="/settings" className="font-medium underline">
              {t("improve.openSettings")}
            </Link>
          )}
        </p>
      )}

      {suggestion && (
        <div className="mt-2 rounded-md border border-brand-200 dark:border-brand-500/40 bg-brand-50/60 dark:bg-brand-500/10 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {t("improve.suggestion")}
            {loading ? ` ${t("improve.writing")}` : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {suggestion}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                onAccept(suggestion.trim());
                setSuggestion("");
              }}
              className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {t("improve.accept")}
            </button>
            <button
              type="button"
              onClick={() => setSuggestion("")}
              className="rounded-md border border-input bg-card px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-muted/50"
            >
              {t("improve.discard")}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={run}
              className="rounded-md border border-input bg-card px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-muted/50 disabled:opacity-60"
            >
              {t("improve.regenerate")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
