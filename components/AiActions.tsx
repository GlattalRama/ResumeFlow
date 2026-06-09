"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Note: "Tailor Resume for this Job" is handled by the dedicated
// TailorResumeFlow (it produces a full new resume version, not just text).
const ACTIONS: { action: string; label: string; persists?: boolean }[] = [
  { action: "generate-qna", label: "Generate Interview Q&A", persists: true },
  { action: "interview-briefing", label: "Generate Interview Briefing" },
  { action: "cover-letter", label: "Generate Cover Letter" },
  { action: "follow-up", label: "Generate Follow-up Message" },
];

export default function AiActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
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
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      if (persists) {
        setNote(data.message || "Done.");
        router.refresh();
      } else {
        setOutput(data.text || "");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs text-gray-400">
        Generated from your resume and this job — review before using.
      </p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.action}
            type="button"
            onClick={() => run(a.action, a.persists)}
            disabled={!!busy}
            className="rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
          >
            {busy === a.action ? "Working…" : a.label}
          </button>
        ))}
      </div>

      {note && <p className="mt-3 text-sm text-green-700">{note}</p>}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {output && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          {output}
        </pre>
      )}
    </div>
  );
}
