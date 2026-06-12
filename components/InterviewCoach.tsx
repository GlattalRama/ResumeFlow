"use client";

import { useMemo, useState } from "react";
import { INTERVIEW_QUESTION_CATEGORIES } from "@/lib/constants";
import type {
  InterviewAnswerFormat,
  InterviewAnswerTone,
  InterviewCoachEntry,
} from "@/lib/types";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";

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

const STATUS_CHIP: Record<InterviewCoachEntry["status"], [string, string]> = {
  draft: ["Draft", "bg-muted text-muted-foreground"],
  aiGenerated: [
    "AI draft",
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  ],
  userEdited: [
    "Edited",
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  ],
  final: [
    "Final",
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  ],
};

// User-facing labels for the AI revision actions (ids match REVISION_ACTIONS
// in lib/aiInterviewCoach).
const REVISE_BUTTONS: { action: string; label: string }[] = [
  { action: "improve", label: "Improve" },
  { action: "shorter", label: "Shorter" },
  { action: "detailed", label: "More detailed" },
  { action: "star", label: "STAR format" },
  { action: "confident", label: "More confident" },
  { action: "professional", label: "More professional" },
  { action: "resumeTone", label: "Align with resume" },
];

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
  const [entries, setEntries] = useState(initialEntries);
  const [scope, setScope] = useState<Scope>(initialApplicationId || "all");
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

  const visible = useMemo(() => {
    if (scope === "all") return entries;
    const appId = scope === "general" ? "" : scope;
    return entries.filter((e) => e.selectedApplicationId === appId);
  }, [entries, scope]);

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
    if (!res.ok) throw new Error(data?.error || "Save failed");
    replaceEntry(data);
    return data as InterviewCoachEntry;
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this question and its answer?")) return;
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
      if (!res.ok) throw new Error(data?.error || "Could not add question");
      setEntries((prev) => [...prev, data]);
      setManualQ("");
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : "Could not add question",
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
      const res = await fetch("/api/ai/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "questions",
          applicationId: selectedApp.id,
          resumeId: contextResumeId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Question generation failed");
      setEntries((prev) => [...prev, ...data.created]);
      setBanner({
        ok: true,
        text: `${data.created.length} new question${
          data.created.length === 1 ? "" : "s"
        } added${data.skipped > 0 ? ` (${data.skipped} already existed)` : ""}.`,
      });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : "Question generation failed",
      });
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Interview Coach"
        subtitle="Prepare questions and answers grounded in your Work Journal, resume, and the job you're targeting."
      />

      {/* Context selector */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-foreground/80">
            Preparing for
          </label>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setBanner(null);
            }}
            className={`${inputClass} max-w-full`}
          >
            <option value="all">All questions</option>
            <option value="general">General practice (no application)</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.jobTitle || "Untitled role"} · {a.company || "Unknown company"}
              </option>
            ))}
          </select>
          {selectedApp && (
            <button
              type="button"
              onClick={generateQuestions}
              disabled={genBusy || !selectedApp.hasJobDescription}
              title={
                selectedApp.hasJobDescription
                  ? undefined
                  : "This application has no job description."
              }
              className={buttonClass("primary")}
            >
              {genBusy ? "Generating…" : "✦ Generate Questions from Job Description"}
            </button>
          )}
        </div>

        {selectedApp && (
          <div className="mt-3 grid gap-x-6 gap-y-1 border-t border-border pt-3 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="font-medium text-foreground/80">Company:</span>{" "}
              {selectedApp.company || "—"}
            </p>
            <p>
              <span className="font-medium text-foreground/80">Job title:</span>{" "}
              {selectedApp.jobTitle || "—"}
            </p>
            <p>
              <span className="font-medium text-foreground/80">Job ID:</span>{" "}
              {selectedApp.jobId || "—"}
            </p>
            <p>
              <span className="font-medium text-foreground/80">Status:</span>{" "}
              {selectedApp.status}
            </p>
            <p>
              <span className="font-medium text-foreground/80">Resume:</span>{" "}
              {contextResumeName ?? "none linked"}
            </p>
            <p>
              <span className="font-medium text-foreground/80">Notes:</span>{" "}
              {selectedApp.noteCount} used as evidence
            </p>
            {selectedApp.jobDescriptionPreview && (
              <p className="sm:col-span-2">
                <span className="font-medium text-foreground/80">JD:</span>{" "}
                {selectedApp.jobDescriptionPreview}
                {selectedApp.jobDescriptionPreview.length >= 280 ? "…" : ""}
              </p>
            )}
          </div>
        )}

        {/* Manual question (Flow A) */}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <input
            value={manualQ}
            onChange={(e) => setManualQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addManual();
            }}
            placeholder='Type a question, e.g. "Tell me about yourself"'
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={addManual}
            disabled={manualBusy || !manualQ.trim()}
            className={buttonClass("secondary")}
          >
            {manualBusy ? "Adding…" : "+ Add question"}
          </button>
        </div>

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

      {/* Question groups */}
      {visible.length === 0 ? (
        <EmptyState
          title="No questions yet"
          hint={
            selectedApp
              ? "Generate questions from the job description, or type one above."
              : "Type a question above, or pick an application to generate JD-based questions."
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => (
            <section key={category}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
                <span className="ml-2 font-normal normal-case">({items.length})</span>
              </h2>
              <div className="space-y-2">
                {items.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onPatch={(patch) => patchEntry(entry.id, patch)}
                    onReplace={replaceEntry}
                    onDelete={() => deleteEntry(entry.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- One question + answer ----

function EntryCard({
  entry,
  onPatch,
  onReplace,
  onDelete,
}: {
  entry: InterviewCoachEntry;
  onPatch: (patch: Record<string, unknown>) => Promise<InterviewCoachEntry>;
  onReplace: (updated: InterviewCoachEntry) => void;
  onDelete: () => void;
}) {
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

  const [statusLabel, statusClass] = STATUS_CHIP[entry.status];
  const hasAnswer = entry.answer.trim().length > 0;

  async function run(fn: () => Promise<void>, key: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  // Generate (no saved answer) or regenerate (explicit confirmation first).
  async function generateAnswer(regenerate: boolean) {
    if (
      regenerate &&
      !window.confirm(
        "Replace the saved answer with a newly generated one? Your current answer will be overwritten (revision history is kept)."
      )
    ) {
      return;
    }
    await run(async () => {
      const res = await fetch("/api/ai/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "answer",
          entryId: entry.id,
          ...(regenerate ? { confirmRegenerate: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Answer generation failed");
      onReplace(data);
      setEditing(false);
    }, "answer");
  }

  async function revise(action: string) {
    await run(async () => {
      const res = await fetch("/api/ai/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "revise", entryId: entry.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Revision failed");
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
    <Card className="!p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-medium text-foreground">{entry.question}</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            {expanded ? "Collapse" : hasAnswer ? "Open" : "Answer"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
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
              <option value="paragraph">Paragraph</option>
              <option value="star">STAR</option>
              <option value="bullets">Bullet points</option>
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
              <option value="neutral">Neutral tone</option>
              <option value="confident">Confident tone</option>
              <option value="professional">Professional tone</option>
            </select>
            {(entry.usedWorkJournal || entry.usedBaseResume) && (
              <span className="text-xs text-muted-foreground">
                Evidence:
                {entry.usedWorkJournal ? " Work Journal" : ""}
                {entry.usedWorkJournal && entry.usedBaseResume ? " +" : ""}
                {entry.usedBaseResume ? " Base Resume" : ""}
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
                placeholder="Write your answer here — or generate one with AI."
                className={`${inputClass} w-full`}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={busy !== null || !draft.trim()}
                  className={buttonClass("primary")}
                >
                  {busy === "save" ? "Saving…" : "Save answer"}
                </button>
                {!hasAnswer && (
                  <button
                    type="button"
                    onClick={() => generateAnswer(false)}
                    disabled={busy !== null}
                    className={buttonClass("secondary")}
                  >
                    {busy === "answer" ? "Generating…" : "✦ Generate answer"}
                  </button>
                )}
                {editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className={buttonClass("secondary")}
                  >
                    Cancel
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
                  Edit
                </button>
                <button type="button" onClick={copyAnswer} className={buttonClass("secondary")}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                {entry.status === "final" ? (
                  <button
                    type="button"
                    onClick={() => run(async () => { await onPatch({ status: "userEdited" }); }, "final")}
                    className={buttonClass("secondary")}
                  >
                    Unmark final
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => run(async () => { await onPatch({ status: "final" }); }, "final")}
                    className={buttonClass("secondary")}
                  >
                    Mark final ✓
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => generateAnswer(true)}
                  disabled={busy !== null}
                  className={buttonClass("secondary")}
                >
                  {busy === "answer" ? "Regenerating…" : "Regenerate…"}
                </button>
              </div>

              {/* AI revision actions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REVISE_BUTTONS.map((b) => (
                  <button
                    key={b.action}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => revise(b.action)}
                    className="rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {busy === `revise:${b.action}` ? "Working…" : `✦ ${b.label}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Revision preview — accept or reject */}
          {revision && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-500/10">
              <p className="mb-1 text-sm font-semibold text-foreground">
                Revised answer
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
                  {busy === "accept" ? "Saving…" : "Accept revision"}
                </button>
                <button
                  type="button"
                  onClick={() => setRevision(null)}
                  className={buttonClass("secondary")}
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Evidence + gaps from the last generation */}
          {entry.evidenceUsed.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground/70">Evidence used</p>
              <ul className="mt-0.5 list-disc pl-4">
                {entry.evidenceUsed.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.gaps.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">Missing evidence</p>
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
                {showHistory ? "▾" : "▸"} Revision history (
                {entry.aiRevisionHistory.length})
              </button>
              {showHistory && (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {[...entry.aiRevisionHistory].reverse().map((r) => (
                    <li key={r.id}>
                      {new Date(r.createdAt).toLocaleString()} — {r.action}
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
              Delete question
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
