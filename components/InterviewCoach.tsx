"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { INTERVIEW_QUESTION_CATEGORIES } from "@/lib/constants";
import type {
  InterviewAnswerFormat,
  InterviewAnswerTone,
  InterviewCoachEntry,
} from "@/lib/types";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import InterviewPractice from "@/components/InterviewPractice";
import InterviewPrintDoc from "@/components/InterviewPrintDoc";
import ResumeTopicBank from "@/components/ResumeTopicBank";
import { aiFetch } from "@/lib/aiConsentClient";
import { exportInterviewDocx } from "@/lib/interviewExport";

export interface CoachAppOption {
  id: string;
  company: string;
  jobTitle: string;
  jobId: string;
  status: string;
  hasJobDescription: boolean;
  jobDescriptionPreview: string;
  resumeVersionUsed: string;
  noteCount: number;
}

export interface CoachResumeOption {
  id: string;
  name: string;
  isBase: boolean;
}

const inputClass =
  "rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// Display classes per entry status; the visible label comes from the
// "interviewCoach.statusChip" message namespace.
const STATUS_CHIP_CLASS: Record<InterviewCoachEntry["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  aiGenerated: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  userEdited:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  final:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

// AI revision action ids (match REVISION_ACTIONS in lib/aiInterviewCoach).
// User-facing labels come from the "interviewCoach.revise" message namespace.
const REVISE_ACTIONS = [
  "improve",
  "shorter",
  "detailed",
  "star",
  "confident",
  "professional",
  "resumeTone",
] as const;

type Scope = "all" | "general" | string;

export default function InterviewCoach({
  initialEntries,
  applications,
  resumes,
  baseResumeId,
  initialApplicationId,
}: {
  initialEntries: InterviewCoachEntry[];
  applications: CoachAppOption[];
  resumes: CoachResumeOption[];
  baseResumeId: string;
  initialApplicationId: string;
}) {
  const t = useTranslations("interviewCoach");
  const tStatus = useTranslations("status");
  const { data: session } = useSession();
  const [entries, setEntries] = useState(initialEntries);
  const [mode, setMode] = useState<"questions" | "practice">("questions");
  const [scope, setScope] = useState<Scope>(initialApplicationId || "all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Ids checked for export (survives filter changes; export only takes the
  // currently-visible subset).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [docxBusy, setDocxBusy] = useState(false);
  const [manualQ, setManualQ] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedApp = applications.find((a) => a.id === scope) ?? null;
  const contextResumeId = selectedApp
    ? selectedApp.resumeVersionUsed || baseResumeId
    : baseResumeId;
  const contextResumeName =
    resumes.find((r) => r.id === contextResumeId)?.name ?? null;

  const scopeFiltered = useMemo(() => {
    if (scope === "all") return entries;
    const appId = scope === "general" ? "" : scope;
    return entries.filter((e) => e.selectedApplicationId === appId);
  }, [entries, scope]);

  // Topics present in the current scope (set by résumé-topic generation).
  const topicOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of scopeFiltered) if (e.topic) set.add(e.topic);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [scopeFiltered]);

  const visible = useMemo(
    () =>
      scopeFiltered.filter(
        (e) =>
          (topicFilter === "all" || e.topic === topicFilter) &&
          (statusFilter === "all" || e.status === statusFilter)
      ),
    [scopeFiltered, topicFilter, statusFilter]
  );

  const grouped = useMemo(() => {
    const groups: { category: string; items: InterviewCoachEntry[] }[] = [];
    for (const category of INTERVIEW_QUESTION_CATEGORIES) {
      const items = visible
        .filter((e) => e.category === category)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (items.length > 0) groups.push({ category, items });
    }
    return groups;
  }, [visible]);

  // Export takes only the selected AND currently-visible questions, so rows
  // hidden by a filter never sneak into a PDF.
  const selectedVisible = useMemo(
    () => visible.filter((e) => selected.has(e.id)),
    [visible, selected]
  );
  const exportGroups = useMemo(
    () =>
      grouped
        .map(({ category, items }) => ({
          category,
          items: items.filter((e) => selected.has(e.id)),
        }))
        .filter((g) => g.items.length > 0),
    [grouped, selected]
  );
  const preparedBy = session?.user?.name ?? "";
  const exportContext = selectedApp
    ? [selectedApp.jobTitle, selectedApp.company].filter(Boolean).join(" · ")
    : "";

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function downloadDocx() {
    setDocxBusy(true);
    try {
      await exportInterviewDocx({
        groups: exportGroups.map(({ category, items }) => ({
          label: t(`category.${category}` as never),
          items: items.map((e) => ({
            question: e.question,
            answer: e.answer,
            topic: e.topic,
            statusLabel: t(`statusChip.${e.status}` as never),
          })),
        })),
        includeAnswers,
        fileBaseName: `interview_prep_${new Date().toISOString().slice(0, 10)}`,
        cover: {
          title: t("export.coverTitle"),
          preparedBy: preparedBy
            ? t("export.preparedBy", { name: preparedBy })
            : "",
          context: exportContext,
          date: new Date().toLocaleDateString(),
          questionCount: t("export.questionCount", {
            count: selectedVisible.length,
          }),
        },
        noAnswerLabel: t("export.noAnswer"),
      });
    } finally {
      setDocxBusy(false);
    }
  }

  function replaceEntry(updated: InterviewCoachEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  async function patchEntry(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/interview-coach/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || t("errors.save"));
    replaceEntry(data);
    return data as InterviewCoachEntry;
  }

  async function deleteEntry(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/interview-coach/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // FLOW A — manual question.
  async function addManual() {
    const question = manualQ.trim();
    if (!question) return;
    setManualBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          source: "manual",
          category: "General",
          selectedApplicationId: selectedApp?.id ?? "",
          selectedResumeId: contextResumeId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.addQuestion"));
      setEntries((prev) => [...prev, data]);
      setManualQ("");
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : t("errors.addQuestion"),
      });
    } finally {
      setManualBusy(false);
    }
  }

  // FLOW B — generate questions from the selected application's JD.
  async function generateQuestions() {
    if (!selectedApp) return;
    setGenBusy(true);
    setBanner(null);
    try {
      const res = await aiFetch("/api/ai/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "questions",
          applicationId: selectedApp.id,
          resumeId: contextResumeId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.questionGeneration"));
      setEntries((prev) => [...prev, ...data.created]);
      setBanner({
        ok: true,
        text:
          data.skipped > 0
            ? t("bannerAddedSkipped", {
                count: data.created.length,
                skipped: data.skipped,
              })
            : t("bannerAdded", { count: data.created.length }),
      });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : t("errors.questionGeneration"),
      });
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <>
    <div className="print:hidden">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Questions vs. Practice */}
      <div className="mb-5 inline-flex rounded-lg border border-input p-0.5">
        {(["questions", "practice"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m ? "bg-brand-600 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "questions" ? t("viewQuestions") : t("viewPractice")}
          </button>
        ))}
      </div>

      {mode === "practice" ? (
        <InterviewPractice
          entries={entries}
          applications={applications}
          resumes={resumes}
          baseResumeId={baseResumeId}
          onEntryUpdated={replaceEntry}
        />
      ) : (
        <>
      {/* Build a deep question bank from the résumé, by topic */}
      <ResumeTopicBank
        resumes={resumes}
        baseResumeId={baseResumeId}
        entries={entries}
        onCreated={(created) => setEntries((prev) => [...created, ...prev])}
      />

      {/* Toolbar: context selector + manual question in one row (wraps on
          small screens). The select is capped so long role names don't blow
          the row apart; the manual input takes the remaining width. */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-foreground/80">
            {t("preparingFor")}
          </label>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setTopicFilter("all");
              setBanner(null);
            }}
            className={`${inputClass} max-w-60 truncate`}
          >
            <option value="all">{t("allQuestions")}</option>
            <option value="general">{t("generalPractice")}</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.jobTitle || t("untitledRole")} ·{" "}
                {a.company || t("unknownCompany")}
              </option>
            ))}
          </select>
          {selectedApp && (
            <button
              type="button"
              onClick={generateQuestions}
              disabled={genBusy || !selectedApp.hasJobDescription}
              title={
                selectedApp.hasJobDescription ? undefined : t("noJobDescription")
              }
              className={buttonClass("primary")}
            >
              {genBusy ? t("generating") : t("generateQuestions")}
            </button>
          )}
          <input
            value={manualQ}
            onChange={(e) => setManualQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addManual();
            }}
            placeholder={t("manualPlaceholder")}
            className={`${inputClass} min-w-48 flex-1`}
          />
          <button
            type="button"
            onClick={addManual}
            disabled={manualBusy || !manualQ.trim()}
            className={buttonClass("secondary")}
          >
            {manualBusy ? t("adding") : t("addQuestion")}
          </button>
        </div>

        {selectedApp && (
          <div className="mt-3 grid gap-x-6 gap-y-1 border-t border-border pt-3 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="font-medium text-foreground/80">
                {t("context.company")}
              </span>{" "}
              {selectedApp.company || "—"}
            </p>
            <p>
              <span className="font-medium text-foreground/80">
                {t("context.jobTitle")}
              </span>{" "}
              {selectedApp.jobTitle || "—"}
            </p>
            <p>
              <span className="font-medium text-foreground/80">
                {t("context.jobId")}
              </span>{" "}
              {selectedApp.jobId || "—"}
            </p>
            <p>
              <span className="font-medium text-foreground/80">
                {t("context.status")}
              </span>{" "}
              {tStatus(selectedApp.status as never)}
            </p>
            <p>
              <span className="font-medium text-foreground/80">
                {t("context.resume")}
              </span>{" "}
              {contextResumeName ?? t("context.noneLinked")}
            </p>
            <p>
              <span className="font-medium text-foreground/80">
                {t("context.notes")}
              </span>{" "}
              {t("context.notesUsed", { count: selectedApp.noteCount })}
            </p>
            {selectedApp.jobDescriptionPreview && (
              <p className="sm:col-span-2">
                <span className="font-medium text-foreground/80">
                  {t("context.jd")}
                </span>{" "}
                {selectedApp.jobDescriptionPreview}
                {selectedApp.jobDescriptionPreview.length >= 280 ? "…" : ""}
              </p>
            )}
          </div>
        )}

        {banner && (
          <p
            className={`mt-3 text-sm ${
              banner.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {banner.text}
          </p>
        )}
      </Card>

      {/* Filters + export selection bar */}
      {scopeFiltered.length > 0 && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {topicOptions.length > 0 && (
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className={`${inputClass} max-w-48 truncate`}
              >
                <option value="all">{t("filters.allTopics")}</option>
                {topicOptions.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">{t("filters.allStatuses")}</option>
              {(
                Object.keys(STATUS_CHIP_CLASS) as InterviewCoachEntry["status"][]
              ).map((s) => (
                <option key={s} value={s}>
                  {t(`statusChip.${s}` as never)}
                </option>
              ))}
            </select>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t("selection.selected", { count: selectedVisible.length })}
              </span>
              <button
                type="button"
                onClick={() =>
                  toggleMany(
                    visible.map((e) => e.id),
                    selectedVisible.length < visible.length
                  )
                }
                className={buttonClass("secondary")}
              >
                {selectedVisible.length < visible.length
                  ? t("selection.selectAll")
                  : t("selection.clear")}
              </button>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                disabled={selectedVisible.length === 0}
                className={buttonClass("primary")}
              >
                {t("export.button")}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Question groups */}
      {visible.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          hint={selectedApp ? t("empty.hintApplication") : t("empty.hintGeneral")}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => {
            const allInCatSelected = items.every((e) => selected.has(e.id));
            return (
            <section key={category}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {/* Category VALUES stay English in the data; display localized. */}
                {t(`category.${category}` as never)}
                <span className="ml-2 font-normal normal-case">({items.length})</span>
                <button
                  type="button"
                  onClick={() =>
                    toggleMany(items.map((e) => e.id), !allInCatSelected)
                  }
                  className="ml-3 font-normal normal-case text-brand-700 hover:underline dark:text-brand-300"
                >
                  {allInCatSelected
                    ? t("selection.clear")
                    : t("selection.selectAll")}
                </button>
              </h2>
              {/* One bordered list per category; rows divided, not card-per-question. */}
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {items.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    selected={selected.has(entry.id)}
                    onToggleSelected={() => toggleSelected(entry.id)}
                    onPatch={(patch) => patchEntry(entry.id, patch)}
                    onReplace={replaceEntry}
                    onDelete={() => deleteEntry(entry.id)}
                  />
                ))}
              </div>
            </section>
            );
          })}
        </div>
      )}
      {/* Export dialog: options + live preview of the printable document */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-xl">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {t("export.title")}
              </h2>
              <label className="ml-auto flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={includeAnswers}
                  onChange={(e) => setIncludeAnswers(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                {t("export.includeAnswers")}
              </label>
            </div>
            <p className="px-5 pt-2 text-xs text-muted-foreground">
              {t("export.questionsOnlyHint")}
            </p>
            <div className="m-5 flex-1 overflow-auto rounded-lg border border-border bg-white p-6">
              <InterviewPrintDoc
                groups={exportGroups}
                includeAnswers={includeAnswers}
                preparedBy={preparedBy}
                context={exportContext}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className={buttonClass("secondary")}
              >
                {t("export.close")}
              </button>
              <button
                type="button"
                onClick={downloadDocx}
                disabled={docxBusy || exportGroups.length === 0}
                className={buttonClass("secondary")}
              >
                {docxBusy ? t("export.working") : t("export.downloadDocx")}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={exportGroups.length === 0}
                className={buttonClass("primary")}
              >
                {t("export.savePdf")}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>

    {/* Print-only copy: window.print() renders exactly this into the PDF
        (everything else on the page is print-hidden). */}
    {exportOpen && exportGroups.length > 0 && (
      <div className="print-area hidden print:block">
        <InterviewPrintDoc
          groups={exportGroups}
          includeAnswers={includeAnswers}
          preparedBy={preparedBy}
          context={exportContext}
        />
      </div>
    )}
    </>
  );
}

// ---- One question + answer ----

function EntryCard({
  entry,
  selected,
  onToggleSelected,
  onPatch,
  onReplace,
  onDelete,
}: {
  entry: InterviewCoachEntry;
  selected: boolean;
  onToggleSelected: () => void;
  onPatch: (patch: Record<string, unknown>) => Promise<InterviewCoachEntry>;
  onReplace: (updated: InterviewCoachEntry) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("interviewCoach");
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<{
    action: string;
    instruction: string;
    revised: string;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusLabel = t(`statusChip.${entry.status}` as never);
  const statusClass = STATUS_CHIP_CLASS[entry.status];
  const hasAnswer = entry.answer.trim().length > 0;

  // Localized label for a revision action id; falls back to the raw id for
  // unknown actions (e.g. legacy history entries).
  function reviseLabel(action: string) {
    return (REVISE_ACTIONS as readonly string[]).includes(action)
      ? t(`revise.${action}` as never)
      : action;
  }

  async function run(fn: () => Promise<void>, key: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setBusy(null);
    }
  }

  // Generate (no saved answer) or regenerate (explicit confirmation first).
  async function generateAnswer(regenerate: boolean) {
    if (regenerate && !window.confirm(t("confirmRegenerate"))) {
      return;
    }
    await run(async () => {
      const res = await aiFetch("/api/ai/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "answer",
          entryId: entry.id,
          ...(regenerate ? { confirmRegenerate: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.answerGeneration"));
      onReplace(data);
      setEditing(false);
    }, "answer");
  }

  async function revise(action: string) {
    await run(async () => {
      const res = await aiFetch("/api/ai/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "revise", entryId: entry.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.revision"));
      setRevision({ action: data.action, instruction: data.instruction, revised: data.revised });
    }, `revise:${action}`);
  }

  async function acceptRevision() {
    if (!revision) return;
    await run(async () => {
      await onPatch({
        appendRevision: {
          action: revision.action,
          instruction: revision.instruction,
          after: revision.revised,
        },
      });
      setRevision(null);
    }, "accept");
  }

  async function saveDraft() {
    await run(async () => {
      await onPatch({ answer: draft, status: "userEdited" });
      setEditing(false);
    }, "save");
  }

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(entry.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      {/* Row header: export checkbox, then a button that toggles the row;
          topic + status chips + rotating chevron. */}
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={t("selection.selectQuestion")}
          className="ml-4 h-4 w-4 shrink-0 accent-brand-600"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition hover:bg-accent/50"
        >
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
            {entry.question}
          </span>
          {entry.topic && (
            <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
              {entry.topic}
            </span>
          )}
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-4">
          {/* Format + tone (used by generation/regeneration) */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              value={entry.answerFormat}
              onChange={(e) =>
                run(async () => {
                  await onPatch({ answerFormat: e.target.value as InterviewAnswerFormat });
                }, "format")
              }
              className={inputClass}
            >
              <option value="paragraph">{t("entry.formatParagraph")}</option>
              <option value="star">{t("entry.formatStar")}</option>
              <option value="bullets">{t("entry.formatBullets")}</option>
            </select>
            <select
              value={entry.tone}
              onChange={(e) =>
                run(async () => {
                  await onPatch({ tone: e.target.value as InterviewAnswerTone });
                }, "tone")
              }
              className={inputClass}
            >
              <option value="neutral">{t("entry.toneNeutral")}</option>
              <option value="confident">{t("entry.toneConfident")}</option>
              <option value="professional">{t("entry.toneProfessional")}</option>
            </select>
            {(entry.usedWorkJournal || entry.usedBaseResume) && (
              <span className="text-xs text-muted-foreground">
                {t("entry.evidence")}
                {entry.usedWorkJournal ? ` ${t("entry.workJournal")}` : ""}
                {entry.usedWorkJournal && entry.usedBaseResume ? " +" : ""}
                {entry.usedBaseResume ? ` ${t("entry.baseResume")}` : ""}
              </span>
            )}
          </div>

          {/* Answer */}
          {editing || !hasAnswer ? (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder={t("entry.answerPlaceholder")}
                className={`${inputClass} w-full`}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={busy !== null || !draft.trim()}
                  className={buttonClass("primary")}
                >
                  {busy === "save" ? t("entry.saving") : t("entry.saveAnswer")}
                </button>
                {!hasAnswer && (
                  <button
                    type="button"
                    onClick={() => generateAnswer(false)}
                    disabled={busy !== null}
                    className={buttonClass("secondary")}
                  >
                    {busy === "answer" ? t("generating") : t("entry.generateAnswer")}
                  </button>
                )}
                {editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className={buttonClass("secondary")}
                  >
                    {t("entry.cancel")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {entry.answer}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(entry.answer);
                    setEditing(true);
                    setRevision(null);
                  }}
                  className={buttonClass("secondary")}
                >
                  {t("entry.edit")}
                </button>
                <button type="button" onClick={copyAnswer} className={buttonClass("secondary")}>
                  {copied ? t("entry.copied") : t("entry.copy")}
                </button>
                {entry.status === "final" ? (
                  <button
                    type="button"
                    onClick={() => run(async () => { await onPatch({ status: "userEdited" }); }, "final")}
                    className={buttonClass("secondary")}
                  >
                    {t("entry.unmarkFinal")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => run(async () => { await onPatch({ status: "final" }); }, "final")}
                    className={buttonClass("secondary")}
                  >
                    {t("entry.markFinal")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => generateAnswer(true)}
                  disabled={busy !== null}
                  className={buttonClass("secondary")}
                >
                  {busy === "answer" ? t("entry.regenerating") : t("entry.regenerate")}
                </button>
              </div>

              {/* AI revision actions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REVISE_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => revise(action)}
                    className="rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {busy === `revise:${action}`
                      ? t("entry.working")
                      : `✦ ${reviseLabel(action)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Revision preview — accept or reject */}
          {revision && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-500/10">
              <p className="mb-1 text-sm font-semibold text-foreground">
                {t("entry.revisedAnswer")}
              </p>
              <p className="mb-2 text-xs text-muted-foreground">{revision.instruction}</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {revision.revised}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={acceptRevision}
                  disabled={busy !== null}
                  className={buttonClass("primary")}
                >
                  {busy === "accept" ? t("entry.saving") : t("entry.acceptRevision")}
                </button>
                <button
                  type="button"
                  onClick={() => setRevision(null)}
                  className={buttonClass("secondary")}
                >
                  {t("entry.reject")}
                </button>
              </div>
            </div>
          )}

          {/* Which Work Journal STAR stories this answer was built from */}
          {(entry.journalStoriesUsed?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
              <span aria-hidden>✦</span>
              <span className="font-medium">{t("entry.builtFromStar")}</span>
              <span>{entry.journalStoriesUsed!.join(", ")}</span>
            </div>
          )}

          {/* Evidence + gaps from the last generation */}
          {entry.evidenceUsed.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground/70">
                {t("entry.evidenceUsed")}
              </p>
              <ul className="mt-0.5 list-disc pl-4">
                {entry.evidenceUsed.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.gaps.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">{t("entry.missingEvidence")}</p>
              <ul className="mt-1 list-disc pl-4">
                {entry.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Revision history */}
          {entry.aiRevisionHistory.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                {showHistory ? "▾" : "▸"}{" "}
                {t("entry.revisionHistory", {
                  count: entry.aiRevisionHistory.length,
                })}
              </button>
              {showHistory && (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {[...entry.aiRevisionHistory].reverse().map((r) => (
                    <li key={r.id}>
                      {new Date(r.createdAt).toLocaleString()} — {reviseLabel(r.action)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              {t("entry.deleteQuestion")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
