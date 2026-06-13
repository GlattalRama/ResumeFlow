"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ResumeData, ResumeVersion, TailoredResumeMetadata } from "@/lib/types";
import type { TailorReasons } from "@/lib/aiTailor";
import { buildTailorChanges, applyTailorChoices } from "@/lib/tailorDiff";
import { scoreResume } from "@/lib/atsScore";
import { TailorChangeCard, ScoreDelta } from "./TailorReview";
import TailorComparePane from "./TailorComparePane";
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
  const t = useTranslations("ai");
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(defaultSourceId);
  const [phase, setPhase] = useState<"pick" | "generating" | "review" | "saving">(
    "pick"
  );
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [sourceRecord, setSourceRecord] = useState<ResumeVersion | null>(null);
  // Keys of changes the user chose to keep original for (see lib/tailorDiff).
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  // Review presentation: per-change diff cards, or both sheets side by side.
  const [view, setView] = useState<"changes" | "compare">("changes");
  const [error, setError] = useState("");

  const hasResumes = resumeOptions.length > 0;

  function reset() {
    setPhase("pick");
    setResult(null);
    setSourceRecord(null);
    setRejected(new Set());
    setView("changes");
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
        setError(data.error || t("tailor.errors.failed"));
        setPhase("pick");
        return;
      }
      if (!srcRes.ok) {
        setError(t("tailor.errors.sourceLoad"));
        setPhase("pick");
        return;
      }
      setSourceRecord((await srcRes.json()) as ResumeVersion);
      setResult(data as TailorResponse);
      setRejected(new Set());
      setPhase("review");
    } catch {
      setError(t("tailor.errors.network"));
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
        setError(data.error || t("tailor.errors.save"));
        setPhase("review");
        return;
      }
      const created = await res.json();
      router.push(`/resumes/${created.id}`);
      router.refresh();
    } catch {
      setError(t("tailor.errors.networkSave"));
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
        {t("tailor.openButton")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className={`max-h-[85vh] w-full overflow-auto rounded-2xl bg-card p-6 shadow-xl transition-all ${
              phase === "review" && view === "compare" ? "max-w-6xl" : "max-w-2xl"
            }`}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {t("tailor.title")}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("tailor.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label={t("tailor.close")}
              >
                ✕
              </button>
            </div>

            {/* No resumes yet: tailoring needs a source resume to work from. */}
            {!hasResumes && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
                  {t("tailor.noResumesBanner")}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className={buttonClass("secondary")}
                  >
                    {t("tailor.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/resumes/new")}
                    className={buttonClass("primary")}
                  >
                    {t("tailor.createResume")}
                  </button>
                </div>
              </div>
            )}

            {/* Pick a source */}
            {hasResumes && (phase === "pick" || phase === "generating") && (
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground/80">
                    {t("tailor.sourceLabel")}
                  </span>
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    disabled={phase === "generating"}
                    className="w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
                  >
                    <option value="">{t("tailor.choosePlaceholder")}</option>
                    {resumeOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id === defaultSourceId
                          ? t("tailor.defaultOption", { label: o.label })
                          : o.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted-foreground/70">
                    {t("tailor.sourceHint")}
                  </span>
                </label>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className={buttonClass("secondary")}
                  >
                    {t("tailor.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={!sourceId || phase === "generating"}
                    className={buttonClass("primary")}
                  >
                    {phase === "generating"
                      ? t("tailor.generating")
                      : t("tailor.generate")}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ScoreDelta before={scoreBefore} after={scoreAfter} />
                    <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted p-0.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setView("changes")}
                        aria-pressed={view === "changes"}
                        className={`rounded-md px-3 py-1.5 transition ${
                          view === "changes"
                            ? "bg-card text-brand-700 dark:text-brand-300 shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        {t("tailor.changesTab", { count: changes.length })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView("compare")}
                        aria-pressed={view === "compare"}
                        className={`rounded-md px-3 py-1.5 transition ${
                          view === "compare"
                            ? "bg-card text-brand-700 dark:text-brand-300 shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        {t("tailor.sideBySide")}
                      </button>
                    </div>
                  </div>

                  {view === "compare" && sourceRecord && finalData ? (
                    <TailorComparePane
                      source={sourceRecord.resumeData}
                      tailored={finalData}
                      selectedTemplate={sourceRecord.selectedTemplate}
                      templateStyle={sourceRecord.templateStyle}
                      sectionState={sourceRecord.sectionState}
                      changedKeys={changes
                        .filter((c) => !rejected.has(c.key))
                        .map((c) => c.key)}
                    />
                  ) : changes.length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                      {t("tailor.noChanges")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("tailor.proposedChanges", { count: changes.length })}
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
                      <p className="font-semibold">{t("tailor.heldBack")}</p>
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
                      {t("tailor.discard")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setSourceRecord(null);
                        setRejected(new Set());
                        setView("changes");
                        setPhase("pick");
                      }}
                      disabled={phase === "saving"}
                      className={buttonClass("secondary")}
                    >
                      {t("tailor.regenerate")}
                    </button>
                    <button
                      type="button"
                      onClick={accept}
                      disabled={phase === "saving" || acceptedCount === 0}
                      title={
                        acceptedCount === 0 ? t("tailor.nothingToSave") : undefined
                      }
                      className={buttonClass("primary")}
                    >
                      {phase === "saving"
                        ? t("tailor.saving")
                        : changes.length === 0
                          ? t("tailor.saveAsNewVersion")
                          : t("tailor.saveWithCount", {
                              accepted: acceptedCount,
                              total: changes.length,
                            })}
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
