"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// Note: "Tailor Resume for this Job" is handled by the dedicated
// TailorResumeFlow (it produces a full new resume version, not just text).
// Labels are looked up under ai.actions.labels keyed by the action id.
const ACTIONS: { action: string; persists?: boolean }[] = [
  { action: "generate-qna", persists: true },
  { action: "interview-briefing" },
  { action: "cover-letter" },
  { action: "follow-up" },
];

export default function AiActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const t = useTranslations("ai");
  const [busy, setBusy] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function run(action: string, persists?: boolean) {
    setBusy(action);
    setOutput("");
    setNote("");
    setError("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, applicationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("actions.errors.generic"));
        return;
      }
      if (persists) {
        setNote(data.message || t("actions.done"));
        router.refresh();
      } else {
        setOutput(data.text || "");
      }
    } catch {
      setError(t("actions.errors.network"));
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground/70">
        {t("actions.intro")}
      </p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.action}
            type="button"
            onClick={() => run(a.action, a.persists)}
            disabled={!!busy}
            className="rounded-md border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 transition hover:bg-brand-100 dark:hover:bg-brand-500/20 disabled:opacity-50"
          >
            {busy === a.action
              ? t("actions.working")
              : t(`actions.labels.${a.action}`)}
          </button>
        ))}
      </div>

      {note && <p className="mt-3 text-sm text-green-700 dark:text-green-300">{note}</p>}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {output && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground/80">
          {output}
        </pre>
      )}
    </div>
  );
}
