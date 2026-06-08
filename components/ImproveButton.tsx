"use client";

import { useState } from "react";
import Link from "next/link";

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
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  async function run() {
    setError(null);
    setNeedsKey(false);
    setSuggestion("");

    if (!text.trim()) {
      setError("Add some text first, then improve it with AI.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType, text }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.text();
        if (res.status === 400 && /key/i.test(msg)) setNeedsKey(true);
        setError(msg || "AI request failed.");
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
      setError("Network error contacting the AI service.");
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
          className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
        >
          <span aria-hidden>✦</span>
          {loading ? "Thinking…" : "Improve with AI"}
        </button>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600">
          {error}{" "}
          {needsKey && (
            <Link href="/settings" className="font-medium underline">
              Open Settings
            </Link>
          )}
        </p>
      )}

      {suggestion && (
        <div className="mt-2 rounded-md border border-brand-200 bg-brand-50/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            AI suggestion{loading ? " (writing…)" : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">
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
              Accept
            </button>
            <button
              type="button"
              onClick={() => setSuggestion("")}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={run}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
