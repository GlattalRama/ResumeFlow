"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeData, ResumeVersion, TailoredResumeMetadata } from "@/lib/types";
import type { TailorReasons } from "@/lib/aiTailor";
import { buildTailorChanges, applyTailorChoices } from "@/lib/tailorDiff";
import { scoreResume } from "@/lib/atsScore";
import { TailorChangeCard, ScoreDelta } from "./TailorReview";
import { buttonClass } from "./ui";

type ResumeOption = { id: string; label: string };

type TailorResponse = {
  resumeData: ResumeData;
  sectionChanges: TailoredResumeMetadata["sectionChanges"];
  reasons?: TailorReasons;
  metadata: TailoredResumeMetadata;
};

// Tailoring flow launched from an application: pick a source resume (defaulting
// to the Base Resume), generate a job-tailored draft, review each change as an
// accept/reject diff card with a live ATS score delta, then save as a NEW
// resume version (the source is never modified) or discard.
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
  const [sourceRecord, setSourceRecord] = useState<ResumeVersion | null>(null);
  // Keys of changes the user chose to keep original for (see lib/tailorDiff).
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const hasResumes = resumeOptions.length > 0;

  function reset() {
    setPhase("pick");
    setResult(null);
    setSourceRecord(null);
    setRejected(new Set());
    setError("");
    setSourceId(defaultSourceId);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function toggleRejected(key: string) {
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function generate() {
    if (!sourceId) return;
    setPhase("generating");
    setError("");
    try {
      // The source record is needed for diffing, the score baseline, and to
      // carry template/layout settings onto the saved variant.
      const [tailorRes, srcRes] = await Promise.all([
        fetch("/api/ai/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceResumeId: sourceId, applicationId }),
        }),
        fetch(`/api/resumes/${sourceId}`),
      ]);
      const data = await tailorRes.json().catch(() => ({}));
      if (!tailorRes.ok) {
        setError(data.error || "Tailoring failed. Please try again.");
        setPhase("pick");
        return;
      }
      if (!srcRes.ok) {
        setError("Could not load the source resume. Please try again.");
        setPhase("pick");
        return;
      }
      setSourceRecord((await srcRes.json()) as ResumeVersion);
      setResult(data as TailorResponse);
      setRejected(new Set());
      setPhase("review");
    } catch {
      setError("Network error. Please try again.");
      setPhase("pick");
    }
  }

  // Review derivations: the change cards, the choice-applied final data, and
  // the before/after ATS scores (after reflects current accept/reject state).
  const changes = useMemo(
    () =>
      result && sourceRecord
        ? buildTailorChanges(sourceRecord.resumeData, result.resumeData, result.reasons)
        : [],
    [result, sourceRecord]
  );
  const finalData = useMemo(
    () =>
      result && sourceRecord
        ? applyTailorChoices(sourceRecord.resumeData, result.resumeData, rejected)
        : null,
    [result, sourceRecord, rejected]
  );
  const jd = result?.metadata.jobDescriptionSnapshot ?? "";
  const scoreBefore = useMemo(
    () => (sourceRecord ? scoreResume(sourceRecord.resumeData, jd) : null),
    [sourceRecord, jd]
  );
  const scoreAfter = useMemo(
    () => (finalData ? scoreResume(finalData, jd) : null),
    [finalData, jd]
  );
  // Guardrail rejections (the verifier kept the source because a proposal
  // failed a fact check) — surfaced so the user knows why something is absent.
  const guardrailNotes =
    result?.sectionChanges.filter((c) => c.changeType === "rejected") ?? [];
  const acceptedCount = changes.length - rejected.size;

  async function accept() {
    if (!result || !sourceRecord || !finalData) return;
    setPhase("saving");
    setError("");
    try {
      const { metadata } = result;
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
          targetRole: metadata.jobTitle || sourceRecord.targetRole || "",
          selectedTemplate: sourceRecord.selectedTemplate,
          templateStyle: sourceRecord.templateStyle,
          formCardState: sourceRecord.formCardState,
          sectionState: sourceRecord.sectionState,
          resumeData: finalData,
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
        className="rounded-md border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 transition hover:bg-brand-100 dark:hover:bg-brand-500/20"
      >
        Tailor Resume for this Job
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Tailor resume for this job
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  AI rephrases and reorders your existing content — it never
                  invents facts. Review each change; your source resume is not
                  modified.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* No resumes yet: tailoring needs a source resume to work from. */}
            {!hasResumes && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
                  You don&apos;t have any resumes yet. Tailoring rephrases an
                  existing resume for this job, so create one first — then come
                  back here to tailor it.
                </div>
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
                    onClick={() => router.push("/resumes/new")}
                    className={buttonClass("primary")}
                  >
                    Create resume
                  </button>
                </div>
              </div>
            )}

            {/* Pick a source */}
            {hasResumes && (phase === "pick" || phase === "generating") && (
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground/80">
                    Source resume
                  </span>
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    disabled={phase === "generating"}
                    className="w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
                  >
                    <option value="">Choose a resume…</option>
                    {resumeOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id === defaultSourceId ? `${o.label} — default` : o.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted-foreground/70">
                    Defaults to your Base Resume. Your own API key (Settings) is
                    recommended for frequent tailoring.
                  </span>
                </label>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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

            {/* Review: score delta + accept/reject diff cards */}
            {(phase === "review" || phase === "saving") &&
              result &&
              scoreBefore &&
              scoreAfter && (
                <div className="space-y-4">
                  <ScoreDelta before={scoreBefore} after={scoreAfter} />

                  {changes.length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                      The tailoring produced no changes — your resume already
                      reads well for this job description.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {changes.length}{" "}
                        {changes.length === 1 ? "proposed change" : "proposed changes"}{" "}
                        — review each one. Rejecting keeps your original wording.
                      </p>
                      {changes.map((change) => (
                        <TailorChangeCard
                          key={change.key}
                          change={change}
                          rejected={rejected.has(change.key)}
                          onToggle={() => toggleRejected(change.key)}
                        />
                      ))}
                    </div>
                  )}

                  {guardrailNotes.length > 0 && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                      <p className="font-semibold">Held back by fact checks:</p>
                      {guardrailNotes.map((c, i) => (
                        <p key={i} className="mt-0.5">
                          {c.note}
                        </p>
                      ))}
                    </div>
                  )}

                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  )}

                  <div className="flex flex-wrap justify-end gap-2">
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
                        setSourceRecord(null);
                        setRejected(new Set());
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
                      disabled={phase === "saving" || acceptedCount === 0}
                      title={
                        acceptedCount === 0
                          ? "Every change is rejected — there's nothing to save."
                          : undefined
                      }
                      className={buttonClass("primary")}
                    >
                      {phase === "saving"
                        ? "Saving…"
                        : changes.length === 0
                          ? "Save as new version"
                          : `Save as new version (${acceptedCount} of ${changes.length})`}
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
