"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { aiFetch } from "@/lib/aiConsentClient";
import { htmlToLines, linesToHtml } from "@/lib/richText";
import {
  normalizeHighlightsSuggestion,
  normalizeSummarySuggestion,
  streamingPreviewText,
} from "@/lib/aiImproveText";
import RichTextEditor from "./RichTextEditor";

// How the section's value is shaped, which decides the editor shown for the
// suggestion and how it is handed back on Accept:
//   • "html"  — a block rich-text value (the Summary); onAccept gets
//               constrained HTML.
//   • "lines" — one inline-HTML line per item (experience highlights);
//               onAccept gets the lines joined with "\n".
//   • "text"  — plain text edited in a textarea.
export type ImproveFormat = "html" | "lines" | "text";

// Per-section "Improve with AI" control. Streams a suggestion from
// /api/ai/improve, then opens it in an editor so the user can adjust it before
// Accept — it never overwrites the resume on its own, and it keeps the field's
// rich-text formatting (bold/italic, paragraphs, lists) instead of flattening
// the result to plain text.
export default function ImproveButton({
  sectionType,
  text,
  onAccept,
  format = "text",
}: {
  sectionType: string;
  // Current value of the section (caller decides how to serialize it): the
  // stored HTML for "html", inline-HTML lines joined by "\n" for "lines".
  text: string;
  // Called with the accepted (possibly edited) suggestion.
  onAccept: (value: string) => void;
  format?: ImproveFormat;
}) {
  const t = useTranslations("ai");
  const [loading, setLoading] = useState(false);
  // Raw streamed answer, shown as plain text while it types out.
  const [streamed, setStreamed] = useState("");
  // Editable draft once streaming finished: block HTML for "html"/"lines",
  // plain text for "text".
  const [draft, setDraft] = useState<string | null>(null);
  // Bumped per suggestion so the editor remounts with the new content.
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  function reset() {
    setStreamed("");
    setDraft(null);
  }

  async function run() {
    setError(null);
    setNeedsKey(false);
    reset();

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
        setStreamed(acc);
      }
      acc += decoder.decode();
      // Hand the finished answer to the editor in the field's own format.
      const normalized =
        format === "html"
          ? normalizeSummarySuggestion(acc)
          : format === "lines"
            ? linesToHtml(normalizeHighlightsSuggestion(acc))
            : acc.trim();
      if (!normalized) {
        setError(t("improve.requestFailed"));
        reset();
        return;
      }
      setDraft(normalized);
      setRound((r) => r + 1);
    } catch {
      setError(t("improve.network"));
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    if (draft == null) return;
    const value =
      format === "lines"
        ? htmlToLines(draft)
            .map((l) => l.replace(/\s*\n\s*/g, " ").trim())
            .join("\n")
        : draft.trim();
    if (!value) return;
    onAccept(value);
    reset();
  }

  const open = loading || streamed || draft != null;

  return (
    <div className="mt-2">
      {!open && (
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

      {open && (
        <div className="mt-2 rounded-md border border-brand-200 dark:border-brand-500/40 bg-brand-50/60 dark:bg-brand-500/10 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {t("improve.suggestion")}
            {loading ? ` ${t("improve.writing")}` : ""}
          </p>

          {draft == null ? (
            // Still streaming: show the answer as plain text as it types out.
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {streamingPreviewText(streamed) || (loading ? "…" : "")}
            </p>
          ) : (
            <>
              <p className="mb-1.5 text-xs text-muted-foreground">
                {t("improve.editHint")}
              </p>
              {format === "text" ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  aria-label={t("improve.suggestion")}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              ) : (
                <RichTextEditor
                  key={round}
                  value={draft}
                  onChange={setDraft}
                  showLists={format === "html"}
                  className="bg-card"
                  hint=""
                />
              )}
            </>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={loading || draft == null}
              onClick={accept}
              className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {t("improve.accept")}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={loading}
              className="rounded-md border border-input bg-card px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-muted/50 disabled:opacity-60"
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
