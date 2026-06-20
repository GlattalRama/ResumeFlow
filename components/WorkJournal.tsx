"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ACHIEVEMENT_CATEGORIES,
  EVIDENCE_TYPES,
  METRIC_TYPES,
  type CareerInsights,
  type Evidence,
  type GeneratedOutputs,
  type Metric,
  type PromotionReadiness,
  type WorkJournalNote,
} from "@/lib/types";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";

// Category slug → i18n key (workJournal.cat*). Keep in sync with
// ACHIEVEMENT_CATEGORIES and messages/*.json.
const CATEGORY_KEY: Record<string, string> = {
  "technical-delivery": "catTechnicalDelivery",
  leadership: "catLeadership",
  "incident-resolution": "catIncidentResolution",
  automation: "catAutomation",
  "process-improvement": "catProcessImprovement",
  "quality-improvement": "catQualityImprovement",
  compliance: "catCompliance",
  "customer-impact": "catCustomerImpact",
  "cost-optimization": "catCostOptimization",
  innovation: "catInnovation",
};

// Metric / evidence type slug → i18n key (workJournal.mt* / workJournal.et*).
const METRIC_TYPE_KEY: Record<string, string> = {
  "time-saved": "mtTimeSaved",
  "cost-saved": "mtCostSaved",
  "revenue-impact": "mtRevenueImpact",
  "defects-prevented": "mtDefectsPrevented",
  "risk-reduced": "mtRiskReduced",
  "customers-impacted": "mtCustomersImpacted",
  "people-influenced": "mtPeopleInfluenced",
  "projects-delivered": "mtProjectsDelivered",
  custom: "mtCustom",
};
const EVIDENCE_TYPE_KEY: Record<string, string> = {
  jira: "etJira",
  "azure-devops": "etAzureDevops",
  servicenow: "etServicenow",
  confluence: "etConfluence",
  document: "etDocument",
  url: "etUrl",
};

// Promotion dimension slug → i18n key (workJournal.pd*).
const PD_KEY: Record<string, string> = {
  "technical-excellence": "pdTechnicalExcellence",
  leadership: "pdLeadership",
  "stakeholder-management": "pdStakeholderManagement",
  delivery: "pdDelivery",
  innovation: "pdInnovation",
  mentoring: "pdMentoring",
  communication: "pdCommunication",
};

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
  category: string; // category slug or ""
  // STAR — the structured story (source of truth).
  situation: string;
  task: string;
  action: string;
  result: string;
  company: string;
  client: string;
  project: string;
  role: string;
  period: string;
  toolsTechnologies: string;
  metricsList: Metric[];
  evidence: Evidence[];
  tags: string; // comma-separated in the form, string[] on the model
  resumeReady: boolean;
}

const EMPTY_FORM: NoteFormValues = {
  title: "",
  category: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  company: "",
  client: "",
  project: "",
  role: "",
  period: "",
  toolsTechnologies: "",
  metricsList: [],
  evidence: [],
  tags: "",
  resumeReady: false,
};

function toForm(n: WorkJournalNote): NoteFormValues {
  const star = n.star ?? { situation: "", task: "", action: "", result: "" };
  // Seed structured metrics from the legacy free-text string for older notes so
  // the value isn't lost — the user can split it into typed rows.
  const metricsList: Metric[] =
    n.metricsList && n.metricsList.length > 0
      ? n.metricsList
      : n.metrics.trim()
        ? [{ type: "custom", label: "", value: n.metrics, unit: "" }]
        : [];
  return {
    title: n.title,
    category: n.category ?? "",
    situation: star.situation,
    task: star.task,
    action: star.action,
    result: star.result,
    company: n.company,
    client: n.client,
    project: n.project,
    role: n.role,
    period: n.period,
    toolsTechnologies: n.toolsTechnologies,
    metricsList,
    evidence: n.evidence ?? [],
    tags: n.tags.join(", "),
    resumeReady: n.resumeReady,
  };
}

// Payload for POST/PATCH. STAR goes as a structured object; the server mirrors
// it into the legacy prose fields, so we don't send those.
function formPayload(f: NoteFormValues) {
  return {
    title: f.title,
    category: f.category,
    star: {
      situation: f.situation,
      task: f.task,
      action: f.action,
      result: f.result,
    },
    company: f.company,
    client: f.client,
    project: f.project,
    role: f.role,
    period: f.period,
    toolsTechnologies: f.toolsTechnologies,
    metricsList: f.metricsList,
    evidence: f.evidence,
    resumeReady: f.resumeReady,
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
  initialInsights = null,
  initialPromotion = null,
}: {
  initialNotes: WorkJournalNote[];
  resumes: ResumePickerOption[];
  initialInsights?: CareerInsights | null;
  initialPromotion?: PromotionReadiness | null;
}) {
  const t = useTranslations("workJournal");
  const locale = useLocale();
  const [notes, setNotes] = useState(initialNotes);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [readyOnly, setReadyOnly] = useState(false);
  // null = no form; "new" = creating; otherwise the id being edited.
  const [formTarget, setFormTarget] = useState<"new" | string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<"entries" | "dashboard" | "promotion">("entries");
  const [insights, setInsights] = useState<CareerInsights | null>(initialInsights);
  const [promotion, setPromotion] = useState<PromotionReadiness | null>(initialPromotion);

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
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || t("saveFailed"));
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
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || t("saveFailed"));
    replaceNote(await res.json());
  }

  async function deleteNote(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/work-journal/${id}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const editingNote =
    formTarget && formTarget !== "new" ? notes.find((n) => n.id === formTarget) : null;

  // Seed a new entry from the most recently touched note so logging several
  // achievements under the same role/engagement doesn't mean retyping the
  // context. The resume schema has no client/project, so a prior note is the
  // only source carrying all four. Period defaults to the current month/year
  // and stays editable.
  const newEntryInitial = useMemo<NoteFormValues>(() => {
    const recent = notes.reduce<WorkJournalNote | null>(
      (best, n) => (!best || n.updatedAt.localeCompare(best.updatedAt) > 0 ? n : best),
      null
    );
    return {
      ...EMPTY_FORM,
      role: recent?.role ?? "",
      company: recent?.company ?? "",
      client: recent?.client ?? "",
      project: recent?.project ?? "",
      period: new Date().toLocaleDateString(locale, { month: "short", year: "numeric" }),
    };
  }, [notes, locale]);

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          view === "entries" ? (
            <button
              type="button"
              className={buttonClass("primary")}
              onClick={() => setFormTarget("new")}
            >
              {t("newEntry")}
            </button>
          ) : undefined
        }
      />

      {/* View toggle: entries list vs. dashboard vs. promotion readiness */}
      <div className="mb-5 inline-flex rounded-lg border border-input p-0.5">
        {(["entries", "dashboard", "promotion"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === v
                ? "bg-brand-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v === "entries"
              ? t("viewEntries")
              : v === "dashboard"
                ? t("viewDashboard")
                : t("viewPromotion")}
          </button>
        ))}
      </div>

      {view === "dashboard" ? (
        <Dashboard
          notes={notes}
          insights={insights}
          onInsights={setInsights}
          locale={locale}
        />
      ) : view === "promotion" ? (
        <PromotionView
          notes={notes}
          readiness={promotion}
          onReadiness={setPromotion}
          locale={locale}
        />
      ) : (
        <>
      {/* Search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
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
          {t("resumeReadyCheck")}
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
            isNew={!editingNote}
            initial={editingNote ? toForm(editingNote) : newEntryInitial}
            heading={editingNote ? t("editEntry") : t("newEntryHeading")}
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
          title={notes.length === 0 ? t("emptyTitle") : t("noMatchTitle")}
          hint={notes.length === 0 ? t("emptyHint") : t("noMatchHint")}
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
        </>
      )}
    </div>
  );
}

// ---- Dashboard ----

const DASH_TECHNICAL = new Set([
  "technical-delivery",
  "automation",
  "quality-improvement",
  "incident-resolution",
]);
const DASH_LEADERSHIP = new Set([
  "leadership",
  "process-improvement",
  "customer-impact",
]);

function Dashboard({
  notes,
  insights,
  onInsights,
  locale,
}: {
  notes: WorkJournalNote[];
  insights: CareerInsights | null;
  onInsights: (i: CareerInsights) => void;
  locale: string;
}) {
  const t = useTranslations("workJournal");

  const stats = useMemo(() => {
    const total = notes.length;
    const resumeReady = notes.filter((n) => n.resumeReady).length;
    const starStories = notes.filter(
      (n) => n.star && (n.star.situation || n.star.task || n.star.action || n.star.result)
    ).length;
    const leadership = notes.filter((n) => n.category && DASH_LEADERSHIP.has(n.category)).length;
    const technical = notes.filter((n) => n.category && DASH_TECHNICAL.has(n.category)).length;
    const withOutputs = notes.filter((n) => n.outputs).length;
    return { total, resumeReady, starStories, leadership, technical, withOutputs };
  }, [notes]);

  // Achievements per month for the last 12 months (by createdAt).
  const trend = useMemo(() => {
    const buckets: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString(locale, { month: "short" }),
        count: 0,
      });
    }
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const n of notes) {
      const key = (n.createdAt || "").slice(0, 7);
      const i = index.get(key);
      if (i !== undefined) buckets[i].count++;
    }
    return buckets;
  }, [notes, locale]);

  const byCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) if (n.category) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const maxTrend = Math.max(1, ...trend.map((b) => b.count));
  const maxCat = Math.max(1, ...byCategory.map(([, n]) => n));

  const cards: [string, number][] = [
    [t("statTotal"), stats.total],
    [t("statResumeReady"), stats.resumeReady],
    [t("statStarStories"), stats.starStories],
    [t("statLeadership"), stats.leadership],
    [t("statTechnical"), stats.technical],
    [t("statWithOutputs"), stats.withOutputs],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-4 font-semibold text-foreground">{t("trendTitle")}</p>
          <div className="flex h-32 items-end gap-1.5">
            {trend.map((b) => (
              <div key={b.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400"
                    style={{ height: `${(b.count / maxTrend) * 100}%` }}
                    title={`${b.count}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="mb-4 font-semibold text-foreground">{t("byCategoryTitle")}</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCategoryData")}</p>
          ) : (
            <ul className="space-y-2.5">
              {byCategory.map(([c, n]) => (
                <li key={c} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate text-muted-foreground">
                    {CATEGORY_KEY[c] ? t(CATEGORY_KEY[c]) : c}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                      style={{ width: `${(n / maxCat) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <InsightsPanel
        notes={notes}
        insights={insights}
        onInsights={onInsights}
        locale={locale}
      />
    </div>
  );
}

function InsightsPanel({
  notes,
  insights,
  onInsights,
  locale,
}: {
  notes: WorkJournalNote[];
  insights: CareerInsights | null;
  onInsights: (i: CareerInsights) => void;
  locale: string;
}) {
  const t = useTranslations("workJournal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stale = !!insights && insights.noteCount !== notes.length;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/career-insights", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("aiRequestFailed"));
      onInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiRequestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <span aria-hidden>✦</span> {t("insightsTitle")}
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={busy || notes.length < 3}
          className={buttonClass("secondary")}
        >
          {busy ? t("generatingOutputs") : insights ? t("regenerateOutputs") : t("generateInsights")}
        </button>
      </div>

      {!insights ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {notes.length < 3 ? t("insightsNeedMore") : t("insightsHint")}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {stale && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {t("insightsStale")}
            </p>
          )}
          <p className="text-sm text-foreground/90">{insights.summary}</p>
          <InsightList title={t("insightsStrengths")} items={insights.strengths} tone="emerald" />
          <InsightList title={t("insightsGaps")} items={insights.gaps} tone="amber" />
          <InsightList title={t("insightsSuggestions")} items={insights.suggestions} tone="brand" />
          <p className="text-xs text-muted-foreground/70">
            {t("outputsGenerated", {
              date: new Date(insights.generatedAt).toLocaleDateString(locale),
            })}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}

function InsightList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber" | "brand";
}) {
  if (items.length === 0) return null;
  const dot =
    tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground/90">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Promotion readiness ----

function PromotionView({
  notes,
  readiness,
  onReadiness,
  locale,
}: {
  notes: WorkJournalNote[];
  readiness: PromotionReadiness | null;
  onReadiness: (r: PromotionReadiness) => void;
  locale: string;
}) {
  const t = useTranslations("workJournal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stale = !!readiness && readiness.noteCount !== notes.length;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/promotion-readiness", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("aiRequestFailed"));
      onReadiness(data.readiness);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiRequestFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Weakest first so the eye lands on what to improve.
  const ranked = readiness
    ? [...readiness.scores].sort((a, b) => a.score - b.score)
    : [];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <span aria-hidden>✦</span> {t("promotionTitle")}
          </p>
          {readiness?.targetLevel && (
            <p className="mt-0.5 text-sm text-muted-foreground">{readiness.targetLevel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy || notes.length < 3}
          className={buttonClass("secondary")}
        >
          {busy
            ? t("generatingOutputs")
            : readiness
              ? t("regenerateOutputs")
              : t("generatePromotion")}
        </button>
      </div>

      {!readiness ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {notes.length < 3 ? t("promotionNeedMore") : t("promotionHint")}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {stale && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {t("promotionStale")}
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <Radar
              points={readiness.scores.map((s) => ({
                label: t(PD_KEY[s.dimension] ?? s.dimension),
                score: s.score,
              }))}
            />
            <ul className="space-y-3">
              {ranked.map((s) => (
                <li key={s.dimension} className="text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-foreground/80">
                      {t(PD_KEY[s.dimension] ?? s.dimension)}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          s.score <= 3
                            ? "bg-amber-500"
                            : "bg-gradient-to-r from-brand-600 to-brand-400"
                        }`}
                        style={{ width: `${s.score * 10}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-muted-foreground">{s.score}/10</span>
                    <span className="w-16 text-right text-xs text-muted-foreground/70">
                      {t("promotionEvidenceCount", { count: s.evidenceCount })}
                    </span>
                  </div>
                  {s.note && (
                    <p className="ml-[10.75rem] mt-0.5 text-xs text-muted-foreground">{s.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {readiness.recommendations.length > 0 && (
            <InsightList
              title={t("promotionRecommendations")}
              items={readiness.recommendations}
              tone="brand"
            />
          )}
          <p className="text-xs text-muted-foreground/70">
            {t("outputsGenerated", {
              date: new Date(readiness.generatedAt).toLocaleDateString(locale),
            })}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}

// Hand-rolled SVG radar — no chart library. Scores are 0-10.
function Radar({ points }: { points: { label: string; score: number }[] }) {
  const n = points.length;
  if (n < 3) return null;
  const cx = 130;
  const cy = 120;
  const r = 78;
  const at = (i: number, frac: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * frac, cy + Math.sin(angle) * r * frac];
  };
  const ring = (frac: number) => points.map((_, i) => at(i, frac).join(",")).join(" ");
  const shape = points.map((p, i) => at(i, Math.max(0, Math.min(10, p.score)) / 10).join(",")).join(" ");
  return (
    <svg viewBox="0 0 260 240" className="mx-auto h-56 w-full max-w-[260px]">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} className="fill-none stroke-border" strokeWidth={1} />
      ))}
      {points.map((_, i) => {
        const [x, y] = at(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
      })}
      <polygon points={shape} className="fill-brand-500/25 stroke-brand-400" strokeWidth={2} />
      {points.map((p, i) => {
        const [x, y] = at(i, 1.16);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[8px]"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

// ---- Note form ----

function NoteForm({
  isNew,
  initial,
  heading,
  onSave,
  onCancel,
}: {
  isNew: boolean;
  initial: NoteFormValues;
  heading: string;
  onSave: (values: NoteFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("workJournal");
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Help Me Write" capture box (new entries only).
  const [capture, setCapture] = useState("");
  const [aiBusy, setAiBusy] = useState<"expand" | "polish" | null>(null);
  // Auto-expand the extra fields when editing an entry that already uses them.
  const hasExtras = Boolean(
    initial.role ||
      initial.company ||
      initial.client ||
      initial.project ||
      initial.period ||
      initial.toolsTechnologies ||
      initial.metricsList.length ||
      initial.evidence.length ||
      initial.tags ||
      initial.resumeReady,
  );
  const [expanded, setExpanded] = useState(hasExtras);

  function set<K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const hasStar = Boolean(values.situation || values.task || values.action || values.result);

  async function callAi(body: Record<string, unknown>) {
    const res = await fetch("/api/ai/career", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || t("aiExpandFailed"));
    return data;
  }

  // "Help Me Write": expand a rough sentence into STAR + a suggested category.
  async function helpMeWrite() {
    if (capture.trim().length < 8) return;
    setAiBusy("expand");
    setError(null);
    try {
      const data = await callAi({
        action: "expand",
        text: capture,
        role: values.role,
        company: values.company,
        client: values.client,
        project: values.project,
      });
      const s = data.star ?? {};
      setValues((v) => ({
        ...v,
        situation: s.situation ?? "",
        task: s.task ?? "",
        action: s.action ?? "",
        result: s.result ?? "",
        category: typeof data.category === "string" ? data.category : v.category,
        // Seed a title from the rough text if the user hasn't typed one.
        title: v.title.trim() ? v.title : capture.trim().slice(0, 80),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiExpandFailed"));
    } finally {
      setAiBusy(null);
    }
  }

  // "Polish wording": tighten the current STAR draft, facts unchanged.
  async function polish() {
    if (!hasStar) return;
    setAiBusy("polish");
    setError(null);
    try {
      const data = await callAi({
        action: "polish",
        star: {
          situation: values.situation,
          task: values.task,
          action: values.action,
          result: values.result,
        },
      });
      const s = data.star ?? {};
      setValues((v) => ({
        ...v,
        situation: s.situation ?? v.situation,
        task: s.task ?? v.task,
        action: s.action ?? v.action,
        result: s.result ?? v.result,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiExpandFailed"));
    } finally {
      setAiBusy(null);
    }
  }

  async function submit() {
    if (!values.title.trim()) {
      setError(t("errorNoTitle"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
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

  const area = (key: keyof NoteFormValues, label: string, placeholder = "", rows = 2) => (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        value={values[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        placeholder={placeholder}
        rows={rows}
        className={inputClass}
      />
    </div>
  );

  return (
    <Card>
      <h2 className="mb-4 font-semibold text-foreground">{heading}</h2>

      {/* Help Me Write — capture a rough sentence and let AI draft the STAR. */}
      {isNew && (
        <div className="mb-5 rounded-lg border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-500/10">
          <label className={labelClass}>{t("captureHeading")}</label>
          <textarea
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            placeholder={t("phCapture")}
            rows={2}
            className={inputClass}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{t("captureHint")}</p>
            <button
              type="button"
              onClick={helpMeWrite}
              disabled={aiBusy !== null || capture.trim().length < 8}
              className={buttonClass("primary")}
            >
              {aiBusy === "expand" ? t("expanding") : t("helpMeWrite")}
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="mb-4">{text("title", t("labelTitle"), t("phTitle"))}</div>

      {/* Category */}
      <div className="mb-4">
        <label className={labelClass}>{t("labelCategory")}</label>
        <div className="flex flex-wrap gap-1.5">
          {ACHIEVEMENT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("category", values.category === c ? "" : c)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                values.category === c
                  ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                  : "border-input text-muted-foreground hover:bg-accent"
              }`}
            >
              {t(CATEGORY_KEY[c])}
            </button>
          ))}
        </div>
      </div>

      {/* STAR — the story */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground/80">{t("storyHeading")}</p>
          <button
            type="button"
            onClick={polish}
            disabled={aiBusy !== null || !hasStar}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-50 dark:text-brand-300"
          >
            {aiBusy === "polish" ? t("polishing") : t("polishWording")}
          </button>
        </div>
        {area("situation", t("labelSituation"), t("phSituation"))}
        {area("task", t("labelTask"), t("phTask"))}
        {area("action", t("labelAction"), t("phAction"))}
        {area("result", t("labelResult"), t("phResult"))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        <span
          className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▸
        </span>
        {expanded ? t("fewerDetails") : t("moreDetails")}
      </button>

      {/* Optional context, kept out of the way until needed. */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-input pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("role", t("labelRole"), t("phRole"))}
            {text("company", t("labelCompany"))}
            {text("client", t("labelClient"))}
            {text("project", t("labelProject"))}
            {text("period", t("labelPeriod"), t("phPeriod"))}
          </div>
          {text("toolsTechnologies", t("labelTools"), t("phTools"))}
          <MetricsEditor
            metrics={values.metricsList}
            onChange={(metricsList) => set("metricsList", metricsList)}
          />
          <EvidenceList
            evidence={values.evidence}
            onChange={(evidence) => set("evidence", evidence)}
          />
          <div className="grid items-end gap-4 sm:grid-cols-2">
            {text("tags", t("labelTags"), t("phTags"))}
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={values.resumeReady}
                onChange={(e) => set("resumeReady", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {t("resumeReady")}
            </label>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className={buttonClass("primary")}>
          {busy ? t("saving") : t("saveEntry")}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
          {t("cancel")}
        </button>
      </div>
    </Card>
  );
}

// ---- Metrics & evidence editors ----

const selectClass =
  "rounded-md border border-input bg-card text-foreground px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function MetricsEditor({
  metrics,
  onChange,
}: {
  metrics: Metric[];
  onChange: (next: Metric[]) => void;
}) {
  const t = useTranslations("workJournal");
  const update = (i: number, patch: Partial<Metric>) =>
    onChange(metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => onChange(metrics.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([...metrics, { type: "time-saved", label: "", value: "", unit: "" }]);

  return (
    <div>
      <label className={labelClass}>{t("labelMetrics")}</label>
      <div className="space-y-2">
        {metrics.map((m, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={m.type}
              onChange={(e) => update(i, { type: e.target.value as Metric["type"] })}
              className={`${selectClass} min-w-[8rem]`}
            >
              {METRIC_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {t(METRIC_TYPE_KEY[mt])}
                </option>
              ))}
            </select>
            {m.type === "custom" && (
              <input
                value={m.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder={t("mtCustom")}
                className={`${inputClass} w-32`}
              />
            )}
            <input
              value={m.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder={t("phMetricValue")}
              className={`${inputClass} flex-1`}
            />
            <input
              value={m.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
              placeholder={t("phMetricUnit")}
              className={`${inputClass} w-28`}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t("remove")}
              className="rounded-md border border-input px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          {t("addMetric")}
        </button>
      </div>
    </div>
  );
}

function EvidenceList({
  evidence,
  onChange,
}: {
  evidence: Evidence[];
  onChange: (next: Evidence[]) => void;
}) {
  const t = useTranslations("workJournal");
  const update = (i: number, patch: Partial<Evidence>) =>
    onChange(evidence.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const remove = (i: number) => onChange(evidence.filter((_, idx) => idx !== i));
  const add = () => onChange([...evidence, { type: "jira", label: "", url: "" }]);

  return (
    <div>
      <label className={labelClass}>{t("labelEvidence")}</label>
      <div className="space-y-2">
        {evidence.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={e.type}
              onChange={(ev) => update(i, { type: ev.target.value as Evidence["type"] })}
              className={`${selectClass} min-w-[8rem]`}
            >
              {EVIDENCE_TYPES.map((et) => (
                <option key={et} value={et}>
                  {t(EVIDENCE_TYPE_KEY[et])}
                </option>
              ))}
            </select>
            <input
              value={e.label}
              onChange={(ev) => update(i, { label: ev.target.value })}
              placeholder={t("phEvidenceLabel")}
              className={`${inputClass} flex-1`}
            />
            <input
              value={e.url}
              onChange={(ev) => update(i, { url: ev.target.value })}
              placeholder={t("phEvidenceUrl")}
              type="url"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t("remove")}
              className="rounded-md border border-input px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          {t("addEvidence")}
        </button>
        {evidence.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("evidenceHint")}</p>
        )}
      </div>
    </div>
  );
}

// ---- Multi-output engine ----

function OutputsPanel({
  outputs,
  stale,
  busy,
  onGenerate,
  locale,
}: {
  outputs?: GeneratedOutputs;
  stale: boolean;
  busy: boolean;
  onGenerate: () => void;
  locale: string;
}) {
  const t = useTranslations("workJournal");
  const rows: [string, string][] = outputs
    ? [
        [t("outputResumeBullet"), outputs.resumeBullet],
        [t("outputStarStory"), outputs.starStory],
        [t("outputLinkedin"), outputs.linkedinPost],
        [t("outputPerfReview"), outputs.perfReviewBlurb],
      ]
    : [];

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{t("outputsHeading")}</p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className={buttonClass("secondary")}
        >
          {busy
            ? t("generatingOutputs")
            : outputs
              ? t("regenerateOutputs")
              : t("generateOutputs")}
        </button>
      </div>
      {!outputs ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("outputsHint")}</p>
      ) : (
        <>
          {stale && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {t("outputsStale")}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {rows
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <OutputRow key={label} label={label} value={value} />
              ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70">
            {t("outputsGenerated", {
              date: new Date(outputs.generatedAt).toLocaleDateString(locale),
            })}
          </p>
        </>
      )}
    </div>
  );
}

function OutputRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations("workJournal");
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          {copied ? "✓" : t("copy")}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground/90">{value}</p>
    </div>
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
  const t = useTranslations("workJournal");
  const locale = useLocale();
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
      if (!res.ok) throw new Error(data?.error || t("aiRequestFailed"));
      if (action === "bullets") setPreview({ kind: "bullets", bullets: data.bullets });
      else if (action === "improve") setPreview({ kind: "improve", fields: data.fields });
      else setPreview({ kind: "star", star: data.star });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t("aiRequestFailed"));
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

  // Generate all four outputs in one call and cache them on the note.
  async function generateOutputs() {
    setAiBusy("outputs");
    setAiError(null);
    try {
      const res = await fetch("/api/ai/work-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: note.id, action: "outputs" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("aiRequestFailed"));
      await onPatch({ outputs: data.outputs });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t("aiRequestFailed"));
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <Card>
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{note.title}</p>
            {note.category && CATEGORY_KEY[note.category] && (
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
                {t(CATEGORY_KEY[note.category])}
              </span>
            )}
          </div>
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
            title={note.resumeReady ? t("titleMarkedReady") : t("titleMarkReady")}
            onClick={() => onPatch({ resumeReady: !note.resumeReady })}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
              note.resumeReady
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            {note.resumeReady ? t("resumeReadyCheck") : t("markReady")}
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            {expanded ? t("collapse") : t("open")}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {note.star ? (
            <>
              <NoteField label={t("labelSituation")} value={note.star.situation} />
              <NoteField label={t("labelTask")} value={note.star.task} />
              <NoteField label={t("labelAction")} value={note.star.action} />
              <NoteField label={t("labelResult")} value={note.star.result} />
            </>
          ) : (
            <>
              <NoteField label={t("labelWhatIDid")} value={note.whatIDid} />
              <NoteField label={t("labelProblemSolved")} value={note.problemSolved} />
              <NoteField label={t("labelImpactResult")} value={note.impactResult} />
            </>
          )}
          <NoteField label={t("labelTools")} value={note.toolsTechnologies} />
          {note.metricsList && note.metricsList.length > 0 ? (
            <div>
              <p className={labelClass}>{t("labelMetrics")}</p>
              <div className="flex flex-wrap gap-1.5">
                {note.metricsList.map((m, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    {(m.label.trim() || t(METRIC_TYPE_KEY[m.type])) +
                      (m.value.trim() ? `: ${m.value}${m.unit.trim() ? ` ${m.unit}` : ""}` : "")}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <NoteField label={t("labelMetrics")} value={note.metrics} />
          )}
          {note.evidence && note.evidence.length > 0 && (
            <div>
              <p className={labelClass}>{t("labelEvidence")}</p>
              <ul className="space-y-1">
                {note.evidence.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-muted-foreground">{t(EVIDENCE_TYPE_KEY[e.type])}: </span>
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline dark:text-brand-300"
                      >
                        {e.label.trim() || e.url}
                      </a>
                    ) : (
                      <span className="text-foreground">{e.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {note.starStory && <NoteField label={t("labelStarStory")} value={note.starStory} />}

          {/* Multi-output engine: 4 ready-to-paste outputs from one AI call. */}
          <OutputsPanel
            outputs={note.outputs}
            stale={!!note.outputs && note.updatedAt > note.outputs.generatedAt}
            busy={aiBusy === "outputs"}
            onGenerate={generateOutputs}
            locale={locale}
          />

          {/* Saved bullets + add-to-resume */}
          {note.generatedResumeBullets.length > 0 && (
            <div>
              <p className={labelClass}>{t("resumeBullets")}</p>
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
              {aiBusy === "bullets" ? t("generating") : t("generateBullets")}
            </button>
            <button
              type="button"
              disabled={!!aiBusy}
              onClick={() => runAi("star")}
              className={buttonClass("secondary")}
            >
              {aiBusy === "star" ? t("writing") : t("generateStar")}
            </button>
            <span className="flex-1" />
            <button type="button" onClick={onEdit} className={buttonClass("secondary")}>
              {t("edit")}
            </button>
            <button type="button" onClick={onDelete} className={buttonClass("danger")}>
              {t("delete")}
            </button>
          </div>

          {aiError && (
            <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
          )}

          {/* AI preview — review before saving */}
          {preview && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-500/10">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {preview.kind === "bullets" && t("suggestedBullets")}
                {preview.kind === "improve" && t("improvedWording")}
                {preview.kind === "star" && t("labelStarStory")}
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
                      [t("labelWhatIDid"), note.whatIDid, preview.fields.whatIDid],
                      [t("labelProblemSolved"), note.problemSolved, preview.fields.problemSolved],
                      [t("labelImpactResult"), note.impactResult, preview.fields.impactResult],
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
                  <p><span className="font-medium">{t("starSituation")}</span> {preview.star.situation}</p>
                  <p><span className="font-medium">{t("starTask")}</span> {preview.star.task}</p>
                  <p><span className="font-medium">{t("starAction")}</span> {preview.star.action}</p>
                  <p><span className="font-medium">{t("starResult")}</span> {preview.star.result}</p>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={acceptPreview} className={buttonClass("primary")}>
                  {preview.kind === "bullets" ? t("saveBulletsToNote") : t("accept")}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className={buttonClass("secondary")}
                >
                  {t("dismiss")}
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t("updatedOn", { date: new Date(note.updatedAt).toLocaleDateString(locale) })}
            {note.linkedResumeId &&
              ` · ${t("bulletAddedTo", {
                name: resumes.find((r) => r.id === note.linkedResumeId)?.name ?? t("fallbackResume"),
              })}`}
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
  const t = useTranslations("workJournal");
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
      if (!res.ok) throw new Error(data?.error || t("couldNotAddBullet"));
      setStatus({ ok: true, message: t("addedTo", { name: selected?.name ?? t("resumeFallback") }) });
      setOpen(false);
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : t("couldNotAddBullet"),
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
            {t("copy")}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={resumes.length === 0}
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            {t("addToResume")}
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
                {r.isBase ? ` ${t("baseResumeSuffix")}` : ""}
              </option>
            ))}
          </select>
          {selected.experience.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("noExperienceEntries")}
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
                {busy ? t("adding") : t("addBullet")}
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
