"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeData, TailoredResumeMetadata } from "@/lib/types";
import { buttonClass } from "./ui";

type ResumeOption = { id: string; label: string };

type TailorResponse = {
  resumeData: ResumeData;
  sectionChanges: TailoredResumeMetadata["sectionChanges"];
  metadata: TailoredResumeMetadata;
};

// Visual accent per change outcome in the review summary.
const CHANGE_BADGE: Record<string, string> = {
  rephrased: "bg-blue-50 text-blue-700 ring-blue-200",
  reordered: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  emphasized: "bg-violet-50 text-violet-700 ring-violet-200",
  unchanged: "bg-gray-50 text-gray-500 ring-gray-200",
  rejected: "bg-amber-50 text-amber-700 ring-amber-200",
};

const SECTION_LABEL: Record<string, string> = {
  summary: "Summary",
  experience: "Work Experience",
  skills: "Skills",
  areasOfExpertise: "Areas of Expertise",
};

// Tailoring flow launched from an application: pick a source resume (defaulting
// to the Base Resume), generate a job-tailored draft, review the section-level
// changes, then accept (creates a new resume version) or discard.
export default function TailorResumeFlow({
  applicationId,
  resumeOptions,
  defaultSourceId,
}: {
  applicationId: string;
  resumeOptions: ResumeOption[];
  // Base Resume id if set, else the linked/most-relevant version, else "".
  defaultSourceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(defaultSourceId);
  const [phase, setPhase] = useState<"pick" | "generating" | "review" | "saving">(
    "pick"
  );
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [error, setError] = useState("");

  const hasResumes = resumeOptions.length > 0;

  function reset() {
    setPhase("pick");
    setResult(null);
    setError("");
    setSourceId(defaultSourceId);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function generate() {
    if (!sourceId) return;
    setPhase("generating");
    setError("");
    try {
      const res = await fetch("/api/ai/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceResumeId: sourceId, applicationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Tailoring failed. Please try again.");
        setPhase("pick");
        return;
      }
      setResult(data as TailorResponse);
      setPhase("review");
    } catch {
      setError("Network error. Please try again.");
      setPhase("pick");
    }
  }

  async function accept() {
    if (!result) return;
    setPhase("saving");
    setError("");
    try {
      // Carry the source version's template + layout settings onto the new one.
      const src = await fetch(`/api/resumes/${sourceId}`).then((r) =>
        r.ok ? r.json() : null
      );
      const { metadata, resumeData } = result;
      const name =
        `${metadata.jobTitle || "Tailored"} – ${metadata.company || "role"}`.slice(
          0,
          80
        );
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionName: name,
          targetRole: metadata.jobTitle || src?.targetRole || "",
          selectedTemplate: src?.selectedTemplate,
          templateStyle: src?.templateStyle,
          formCardState: src?.formCardState,
          sectionState: src?.sectionState,
          resumeData,
          origin: "tailored",
          sourceResumeId: sourceId,
          tailoredMetadata: metadata,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not save the tailored resume.");
        setPhase("review");
        return;
      }
      const created = await res.json();
      router.push(`/resumes/${created.id}`);
      router.refresh();
    } catch {
      setError("Network error while saving. Please try again.");
      setPhase("review");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasResumes}
        title={hasResumes ? undefined : "Create a resume version first"}
        className="rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
      >
        Tailor Resume for this Job
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Tailor resume for this job
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  AI rephrases and reorders your existing content — it never
                  invents facts. Review before saving.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Pick a source */}
            {(phase === "pick" || phase === "generating") && (
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">
                    Source resume
                  </span>
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    disabled={phase === "generating"}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Choose a resume…</option>
                    {resumeOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id === defaultSourceId ? `${o.label} — default` : o.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-gray-400">
                    Defaults to your Base Resume. Your own API key (Settings) is
                    recommended for frequent tailoring.
                  </span>
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className={buttonClass("secondary")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={!sourceId || phase === "generating"}
                    className={buttonClass("primary")}
                  >
                    {phase === "generating" ? "Tailoring…" : "Generate"}
                  </button>
                </div>
              </div>
            )}

            {/* Review */}
            {(phase === "review" || phase === "saving") && result && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    What changed
                  </p>
                  <ul className="space-y-2">
                    {result.sectionChanges.map((c) => (
                      <li
                        key={c.section}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span
                          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${
                            CHANGE_BADGE[c.changeType] ?? CHANGE_BADGE.unchanged
                          }`}
                        >
                          {c.changeType}
                        </span>
                        <span className="text-gray-700">
                          <span className="font-medium">
                            {SECTION_LABEL[c.section] ?? c.section}:
                          </span>{" "}
                          {c.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {result.resumeData.basics.summary && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-700">
                      Tailored summary
                    </p>
                    <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                      {result.resumeData.basics.summary}
                    </p>
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={phase === "saving"}
                    className={buttonClass("secondary")}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setPhase("pick");
                    }}
                    disabled={phase === "saving"}
                    className={buttonClass("secondary")}
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={accept}
                    disabled={phase === "saving"}
                    className={buttonClass("primary")}
                  >
                    {phase === "saving" ? "Saving…" : "Accept & save as new version"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
