"use client";

import { useMemo, useState } from "react";
import type { WorkJournalNote } from "@/lib/types";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";

export interface ResumePickerOption {
  id: string;
  name: string;
  isBase: boolean;
  // Labels of resumeData.experience entries, in index order.
  experience: string[];
}

const inputClass =
  "w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-foreground/80";

// ---- Form state ----

interface NoteFormValues {
  title: string;
  company: string;
  client: string;
  project: string;
  role: string;
  period: string;
  whatIDid: string;
  toolsTechnologies: string;
  problemSolved: string;
  impactResult: string;
  metrics: string;
  tags: string; // comma-separated in the form, string[] on the model
  resumeReady: boolean;
}

const EMPTY_FORM: NoteFormValues = {
  title: "",
  company: "",
  client: "",
  project: "",
  role: "",
  period: "",
  whatIDid: "",
  toolsTechnologies: "",
  problemSolved: "",
  impactResult: "",
  metrics: "",
  tags: "",
  resumeReady: false,
};

function toForm(n: WorkJournalNote): NoteFormValues {
  return {
    title: n.title,
    company: n.company,
    client: n.client,
    project: n.project,
    role: n.role,
    period: n.period,
    whatIDid: n.whatIDid,
    toolsTechnologies: n.toolsTechnologies,
    problemSolved: n.problemSolved,
    impactResult: n.impactResult,
    metrics: n.metrics,
    tags: n.tags.join(", "),
    resumeReady: n.resumeReady,
  };
}

function formPayload(f: NoteFormValues) {
  return {
    ...f,
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

// ---- AI preview state (review before save) ----

type AiPreview =
  | { kind: "bullets"; bullets: string[] }
  | { kind: "improve"; fields: { whatIDid: string; problemSolved: string; impactResult: string } }
  | { kind: "star"; star: { situation: string; task: string; action: string; result: string } };

export default function WorkJournal({
  initialNotes,
  resumes,
}: {
  initialNotes: WorkJournalNote[];
  resumes: ResumePickerOption[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [readyOnly, setReadyOnly] = useState(false);
  // null = no form; "new" = creating; otherwise the id being edited.
  const [formTarget, setFormTarget] = useState<"new" | string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) for (const t of n.tags) set.add(t);
    return [...set].sort();
  }, [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (readyOnly && !n.resumeReady) return false;
        if (tagFilter && !n.tags.includes(tagFilter)) return false;
        if (!q) return true;
        const hay = [
          n.title,
          n.company,
          n.client,
          n.project,
          n.role,
          n.period,
          n.whatIDid,
          n.toolsTechnologies,
          n.problemSolved,
          n.impactResult,
          n.metrics,
          n.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, query, tagFilter, readyOnly]);

  function replaceNote(updated: WorkJournalNote) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  async function createNote(values: NoteFormValues) {
    const res = await fetch("/api/work-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload(values)),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Save failed");
    const created: WorkJournalNote = await res.json();
    setNotes((prev) => [created, ...prev]);
    setFormTarget(null);
    setExpandedId(created.id);
  }

  async function updateNote(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/work-journal/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Save failed");
    replaceNote(await res.json());
  }

  async function deleteNote(id: string) {
    if (!window.confirm("Delete this journal entry? This can't be undone.")) return;
    const res = await fetch(`/api/work-journal/${id}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const editingNote =
    formTarget && formTarget !== "new" ? notes.find((n) => n.id === formTarget) : null;

  return (
    <div>
      <PageHeader
        title="Work Journal"
        subtitle="Capture projects, achievements, and STAR stories while they're fresh — then turn them into resume bullets."
        action={
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={() => setFormTarget("new")}
          >
            + New entry
          </button>
        }
      />

      {/* Search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entries…"
          className={`${inputClass} max-w-xs`}
        />
        <button
          type="button"
          onClick={() => setReadyOnly((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            readyOnly
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-input text-muted-foreground hover:bg-accent"
          }`}
        >
          ✓ Resume-ready
        </button>
        {allTags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              tagFilter === t
                ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            #{t}
          </button>
        ))}
      </div>

      {/* Create / edit form */}
      {formTarget && (
        <div className="mb-4">
          <NoteForm
            key={formTarget}
            initial={editingNote ? toForm(editingNote) : EMPTY_FORM}
            heading={editingNote ? "Edit entry" : "New entry"}
            onCancel={() => setFormTarget(null)}
            onSave={async (values) => {
              if (editingNote) {
                await updateNote(editingNote.id, formPayload(values));
                setFormTarget(null);
              } else {
                await createNote(values);
              }
            }}
          />
        </div>
      )}

      {/* List */}
      {visible.length === 0 ? (
        <EmptyState
          title={notes.length === 0 ? "No journal entries yet" : "No entries match"}
          hint={
            notes.length === 0
              ? "Write down what you worked on — the project, the problem, the impact — before you forget the details."
              : "Try a different search or clear the filters."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              resumes={resumes}
              expanded={expandedId === n.id}
              onToggle={() => setExpandedId((cur) => (cur === n.id ? null : n.id))}
              onEdit={() => {
                setFormTarget(n.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onDelete={() => deleteNote(n.id)}
              onPatch={(patch) => updateNote(n.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Note form ----

function NoteForm({
  initial,
  heading,
  onSave,
  onCancel,
}: {
  initial: NoteFormValues;
  heading: string;
  onSave: (values: NoteFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit() {
    if (!values.title.trim()) {
      setError("Give the entry a title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const text = (key: keyof NoteFormValues, label: string, placeholder = "") => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        value={values[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );

  const area = (key: keyof NoteFormValues, label: string, placeholder = "") => (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        value={values[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        placeholder={placeholder}
        rows={3}
        className={inputClass}
      />
    </div>
  );

  return (
    <Card>
      <h2 className="mb-4 font-semibold text-foreground">{heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("title", "Title *", "e.g. Migrated batch jobs to cloud scheduler")}
        {text("role", "Your role", "e.g. Senior Mainframe Developer")}
        {text("company", "Company")}
        {text("client", "Client")}
        {text("project", "Project")}
        {text("period", "Period", "e.g. Jan 2026 – Mar 2026")}
      </div>
      <div className="mt-4 space-y-4">
        {area("whatIDid", "What I did", "The work itself — be specific.")}
        {area("problemSolved", "Problem solved", "What was broken, slow, risky, or missing?")}
        {area("impactResult", "Impact / result", "What changed because of your work?")}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("toolsTechnologies", "Tools & technologies", "e.g. COBOL, JCL, DB2, AWS")}
          {text("metrics", "Metrics", "e.g. 40% faster, $200k saved, 0 defects")}
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          {text("tags", "Tags (comma-separated)", "e.g. migration, leadership")}
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={values.resumeReady}
              onChange={(e) => set("resumeReady", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Resume-ready
          </label>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Save entry"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ---- Note card ----

function NoteCard({
  note,
  resumes,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onPatch,
}: {
  note: WorkJournalNote;
  resumes: ResumePickerOption[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AiPreview | null>(null);

  const meta = [note.company, note.client, note.project, note.period]
    .filter(Boolean)
    .join(" · ");

  async function runAi(action: "bullets" | "improve" | "star") {
    setAiBusy(action);
    setAiError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/ai/work-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: note.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "AI request failed");
      if (action === "bullets") setPreview({ kind: "bullets", bullets: data.bullets });
      else if (action === "improve") setPreview({ kind: "improve", fields: data.fields });
      else setPreview({ kind: "star", star: data.star });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiBusy(null);
    }
  }

  async function acceptPreview() {
    if (!preview) return;
    if (preview.kind === "bullets") {
      await onPatch({ generatedResumeBullets: preview.bullets });
    } else if (preview.kind === "improve") {
      await onPatch(preview.fields);
    } else {
      const s = preview.star;
      await onPatch({
        starStory: [
          `Situation: ${s.situation}`,
          `Task: ${s.task}`,
          `Action: ${s.action}`,
          `Result: ${s.result}`,
        ].join("\n\n"),
      });
    }
    setPreview(null);
  }

  return (
    <Card>
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className="font-semibold text-foreground">{note.title}</p>
          {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
          {note.tags.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {note.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </p>
          )}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={note.resumeReady ? "Marked resume-ready" : "Mark as resume-ready"}
            onClick={() => onPatch({ resumeReady: !note.resumeReady })}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
              note.resumeReady
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            {note.resumeReady ? "✓ Resume-ready" : "Mark ready"}
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            {expanded ? "Collapse" : "Open"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <NoteField label="What I did" value={note.whatIDid} />
          <NoteField label="Problem solved" value={note.problemSolved} />
          <NoteField label="Impact / result" value={note.impactResult} />
          <NoteField label="Tools & technologies" value={note.toolsTechnologies} />
          <NoteField label="Metrics" value={note.metrics} />
          {note.starStory && <NoteField label="STAR story" value={note.starStory} />}

          {/* Saved bullets + add-to-resume */}
          {note.generatedResumeBullets.length > 0 && (
            <div>
              <p className={labelClass}>Resume bullets</p>
              <ul className="space-y-2">
                {note.generatedResumeBullets.map((b, i) => (
                  <BulletRow key={`${i}-${b}`} noteId={note.id} bullet={b} resumes={resumes} />
                ))}
              </ul>
            </div>
          )}

          {/* AI actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!aiBusy}
              onClick={() => runAi("bullets")}
              className={buttonClass("secondary")}
            >
              {aiBusy === "bullets" ? "Generating…" : "✦ Generate resume bullets"}
            </button>
            <button
              type="button"
              disabled={!!aiBusy}
              onClick={() => runAi("improve")}
              className={buttonClass("secondary")}
            >
              {aiBusy === "improve" ? "Improving…" : "✦ Improve wording"}
            </button>
            <button
              type="button"
              disabled={!!aiBusy}
              onClick={() => runAi("star")}
              className={buttonClass("secondary")}
            >
              {aiBusy === "star" ? "Writing…" : "✦ Generate STAR story"}
            </button>
            <span className="flex-1" />
            <button type="button" onClick={onEdit} className={buttonClass("secondary")}>
              Edit
            </button>
            <button type="button" onClick={onDelete} className={buttonClass("danger")}>
              Delete
            </button>
          </div>

          {aiError && (
            <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
          )}

          {/* AI preview — review before saving */}
          {preview && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-500/10">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {preview.kind === "bullets" && "Suggested resume bullets"}
                {preview.kind === "improve" && "Improved wording"}
                {preview.kind === "star" && "STAR story"}
              </p>
              {preview.kind === "bullets" && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {preview.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {preview.kind === "improve" && (
                <div className="space-y-3 text-sm">
                  {(
                    [
                      ["What I did", note.whatIDid, preview.fields.whatIDid],
                      ["Problem solved", note.problemSolved, preview.fields.problemSolved],
                      ["Impact / result", note.impactResult, preview.fields.impactResult],
                    ] as const
                  )
                    .filter(([, before, after]) => before && after && before !== after)
                    .map(([label, before, after]) => (
                      <div key={label}>
                        <p className="font-medium text-foreground/80">{label}</p>
                        <p className="mt-0.5 text-muted-foreground line-through decoration-red-400/60">
                          {before}
                        </p>
                        <p className="mt-0.5 text-foreground">{after}</p>
                      </div>
                    ))}
                </div>
              )}
              {preview.kind === "star" && (
                <div className="space-y-2 text-sm text-foreground">
                  <p><span className="font-medium">Situation:</span> {preview.star.situation}</p>
                  <p><span className="font-medium">Task:</span> {preview.star.task}</p>
                  <p><span className="font-medium">Action:</span> {preview.star.action}</p>
                  <p><span className="font-medium">Result:</span> {preview.star.result}</p>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={acceptPreview} className={buttonClass("primary")}>
                  {preview.kind === "bullets" ? "Save bullets to note" : "Accept"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className={buttonClass("secondary")}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Updated {new Date(note.updatedAt).toLocaleDateString()}
            {note.linkedResumeId &&
              ` · bullet added to ${
                resumes.find((r) => r.id === note.linkedResumeId)?.name ?? "a resume"
              }`}
          </p>
        </div>
      )}
    </Card>
  );
}

function NoteField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

// One saved bullet with the add-to-resume picker.
function BulletRow({
  noteId,
  bullet,
  resumes,
}: {
  noteId: string;
  bullet: string;
  resumes: ResumePickerOption[];
}) {
  const base = resumes.find((r) => r.isBase);
  const [open, setOpen] = useState(false);
  const [resumeId, setResumeId] = useState(base?.id ?? resumes[0]?.id ?? "");
  const [expIndex, setExpIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const selected = resumes.find((r) => r.id === resumeId);

  async function add() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/work-journal/add-to-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, resumeId, experienceIndex: expIndex, bullet }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not add bullet");
      setStatus({ ok: true, message: `Added to ${selected?.name ?? "resume"}.` });
      setOpen(false);
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Could not add bullet",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-foreground">{bullet}</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(bullet)}
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={resumes.length === 0}
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Add to resume…
          </button>
        </div>
      </div>
      {open && selected && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <select
            value={resumeId}
            onChange={(e) => {
              setResumeId(e.target.value);
              setExpIndex(0);
            }}
            className={`${inputClass} w-auto`}
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isBase ? " (Base Resume)" : ""}
              </option>
            ))}
          </select>
          {selected.experience.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              That resume has no experience entries.
            </span>
          ) : (
            <>
              <select
                value={expIndex}
                onChange={(e) => setExpIndex(Number(e.target.value))}
                className={`${inputClass} w-auto`}
              >
                {selected.experience.map((label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={add}
                disabled={busy}
                className={buttonClass("primary")}
              >
                {busy ? "Adding…" : "Add bullet"}
              </button>
            </>
          )}
        </div>
      )}
      {status && (
        <p
          className={`mt-2 text-xs ${
            status.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {status.message}
        </p>
      )}
    </li>
  );
}
