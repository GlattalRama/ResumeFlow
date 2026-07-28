"use client";

// Project & Domain Experience: a library of projects the user worked on —
// domain, description, tech stack, and their roles & responsibilities.
// Sources: pasted text, uploaded documents (PDF/DOCX/TXT) or screenshots;
// AI extracts draft records the user reviews and saves. Nothing is persisted
// until the user saves a reviewed draft (same philosophy as resume import).

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProjectExperience } from "@/lib/types";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import { aiFetch } from "@/lib/aiConsentClient";

const inputClass =
  "rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// A draft being reviewed (extracted or manual) — no id/timestamps yet.
export type ProjectDraft = Omit<
  ProjectExperience,
  "id" | "createdAt" | "updatedAt"
>;

const EMPTY_DRAFT: ProjectDraft = {
  name: "",
  client: "",
  domain: "",
  description: "",
  techStack: "",
  role: "",
  responsibilities: [],
  achievements: [],
  period: "",
};

const ACCEPTED =
  ".pdf,.docx,.txt,.md,image/png,image/jpeg,image/webp";

export default function ProjectExperienceView({
  initialProjects,
}: {
  initialProjects: ProjectExperience[];
}) {
  const t = useTranslations("workJournal.projects");
  const [projects, setProjects] = useState(initialProjects);
  const [drafts, setDrafts] = useState<ProjectDraft[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 5));
  }

  async function extract() {
    setExtracting(true);
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      form.set("text", text);
      for (const f of files) form.append("file", f);
      const res = await aiFetch("/api/ai/project-experience", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("requestFailed"));
      const extracted: ProjectDraft[] = data.projects ?? [];
      if (extracted.length === 0) {
        setNote(t("extractedNone"));
      } else {
        setDrafts((prev) => [...prev, ...extracted]);
        setText("");
        setFiles([]);
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setExtracting(false);
    }
  }

  async function saveDraft(index: number, draft: ProjectDraft) {
    const res = await fetch("/api/project-experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || t("requestFailed"));
    setProjects((prev) => [data, ...prev]);
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveEdit(id: string, draft: ProjectDraft) {
    const res = await fetch(`/api/project-experience/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || t("requestFailed"));
    setProjects((prev) => prev.map((p) => (p.id === id ? data : p)));
    setEditingId(null);
  }

  async function remove(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/project-experience/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      {/* ---- Add: paste text and/or upload documents & screenshots ---- */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{t("addTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("addHint")}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={t("pastePlaceholder")}
          className={`${inputClass} mt-3 w-full`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPTED}
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className={buttonClass("secondary")}
          >
            {t("chooseFiles")}
          </button>
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {f.name}
              <button
                type="button"
                aria-label={t("removeFile")}
                onClick={() =>
                  setFiles((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setDrafts((prev) => [...prev, { ...EMPTY_DRAFT }])}
              className={buttonClass("secondary")}
            >
              {t("manualAdd")}
            </button>
            <button
              type="button"
              onClick={extract}
              disabled={extracting || (!text.trim() && files.length === 0)}
              className={buttonClass("primary")}
            >
              {extracting ? t("extracting") : t("extract")}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
      </Card>

      {/* ---- Drafts under review ---- */}
      {drafts.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("draftsTitle")}
          </h2>
          <p className="mb-2 text-sm text-muted-foreground">{t("draftsHint")}</p>
          <div className="space-y-3">
            {drafts.map((draft, i) => (
              <Card key={i} className="border-brand-200 dark:border-brand-800">
                <ProjectForm
                  initial={draft}
                  saveLabel={t("save")}
                  onSave={(d) => saveDraft(i, d)}
                  onCancel={() =>
                    setDrafts((prev) => prev.filter((_, j) => j !== i))
                  }
                  cancelLabel={t("discard")}
                />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ---- Saved projects ---- */}
      {projects.length === 0 && drafts.length === 0 ? (
        <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} />
      ) : (
        <div className="space-y-3">
          {projects.map((p) =>
            editingId === p.id ? (
              <Card key={p.id}>
                <ProjectForm
                  initial={p}
                  saveLabel={t("save")}
                  onSave={(d) => saveEdit(p.id, d)}
                  onCancel={() => setEditingId(null)}
                  cancelLabel={t("cancel")}
                />
              </Card>
            ) : (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {p.name || "—"}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[p.client, p.period, p.role]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {p.domain && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                      {p.domain}
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="mt-2 text-sm text-foreground">{p.description}</p>
                )}
                {p.techStack && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      {t("fStack")}:
                    </span>{" "}
                    {p.techStack}
                  </p>
                )}
                {p.responsibilities.length > 0 && (
                  <div className="mt-2 text-sm text-foreground">
                    <p className="text-xs font-medium text-foreground/70">
                      {t("responsibilities")}
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {p.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.achievements.length > 0 && (
                  <div className="mt-2 text-sm text-foreground">
                    <p className="text-xs font-medium text-foreground/70">
                      {t("achievements")}
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {p.achievements.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(p.id)}
                    className={buttonClass("secondary")}
                  >
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    {t("delete")}
                  </button>
                </div>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ---- Editable form for one draft/project ----

function ProjectForm({
  initial,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
}: {
  initial: ProjectDraft;
  saveLabel: string;
  cancelLabel: string;
  onSave: (draft: ProjectDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("workJournal.projects");
  const [f, setF] = useState({
    ...initial,
    responsibilitiesText: initial.responsibilities.join("\n"),
    achievementsText: initial.achievements.join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) =>
    setF((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: f.name,
        client: f.client,
        domain: f.domain,
        description: f.description,
        techStack: f.techStack,
        role: f.role,
        period: f.period,
        responsibilities: f.responsibilitiesText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        achievements: f.achievementsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  const field = (label: string, key: keyof typeof f, placeholder = "") => (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-foreground/70">
        {label}
      </span>
      <input
        value={String(f[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} w-full`}
      />
    </label>
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field(t("fName"), "name")}
        {field(t("fClient"), "client")}
        {field(t("fDomain"), "domain", t("fDomainPlaceholder"))}
        {field(t("fPeriod"), "period")}
        {field(t("fRole"), "role")}
        {field(t("fStack"), "techStack")}
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground/70">
          {t("fDescription")}
        </span>
        <textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={`${inputClass} w-full`}
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground/70">
          {t("fResponsibilities")}
        </span>
        <textarea
          value={f.responsibilitiesText}
          onChange={(e) => set("responsibilitiesText", e.target.value)}
          rows={5}
          className={`${inputClass} w-full`}
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground/70">
          {t("fAchievements")}
        </span>
        <textarea
          value={f.achievementsText}
          onChange={(e) => set("achievementsText", e.target.value)}
          rows={3}
          className={`${inputClass} w-full`}
        />
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={buttonClass("primary")}
        >
          {busy ? t("saving") : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("secondary")}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
