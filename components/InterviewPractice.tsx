"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  InterviewCoachEntry,
  PracticeFeedback,
  PracticeSession,
} from "@/lib/types";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import { useSpeechToText } from "@/components/useSpeechToText";

const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
};

const inputClass =
  "w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-foreground/80";

export interface PracticeAppOption {
  id: string;
  jobTitle: string;
  company: string;
  resumeVersionUsed: string;
}
export interface PracticeResumeOption {
  id: string;
  name: string;
  isBase: boolean;
}

type Screen = "home" | "review" | "run" | "summary";

export default function InterviewPractice({
  entries,
  applications,
  resumes,
  baseResumeId,
  onEntryUpdated,
}: {
  entries: InterviewCoachEntry[];
  applications: PracticeAppOption[];
  resumes: PracticeResumeOption[];
  baseResumeId: string;
  onEntryUpdated: (entry: InterviewCoachEntry) => void;
}) {
  const t = useTranslations("interviewCoach.practice");
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [screen, setScreen] = useState<Screen>("home");
  const [active, setActive] = useState<PracticeSession | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/interview-practice")
      .then((r) => (r.ok ? r.json() : []))
      .then((s) => {
        if (alive && Array.isArray(s)) setSessions(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  // Most recent graded "overall" per question, across all sessions.
  const lastScore = useMemo(() => {
    const m = new Map<string, { score: number; at: string }>();
    for (const s of sessions) {
      for (const a of s.attempts) {
        if (!a.feedback) continue;
        const at = a.feedback.gradedAt;
        const prev = m.get(a.entryId);
        if (!prev || at.localeCompare(prev.at) > 0) {
          m.set(a.entryId, { score: a.feedback.overall, at });
        }
      }
    }
    return m;
  }, [sessions]);

  function upsertSession(s: PracticeSession) {
    setSessions((prev) => {
      const i = prev.findIndex((x) => x.id === s.id);
      if (i === -1) return [s, ...prev];
      const next = [...prev];
      next[i] = s;
      return next;
    });
    setActive((cur) => (cur && cur.id === s.id ? s : cur));
  }

  async function createSession(opts: {
    entryIds: string[];
    name: string;
    source: string;
    contextAppId: string;
    repeatOf?: string;
    setId?: string;
    review?: boolean;
  }) {
    const app = applications.find((a) => a.id === opts.contextAppId);
    const resumeId = app ? app.resumeVersionUsed || baseResumeId : baseResumeId;
    const res = await fetch("/api/interview-practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryIds: opts.entryIds,
        name: opts.name,
        source: opts.source,
        selectedApplicationId: opts.contextAppId,
        selectedResumeId: resumeId,
        repeatOf: opts.repeatOf,
        setId: opts.setId,
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || t("requestFailed"));
    const session: PracticeSession = await res.json();
    upsertSession(session);
    setActive(session);
    setScreen(opts.review ? "review" : "run");
  }

  async function deleteSession(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/interview-practice/${id}`, { method: "DELETE" });
    if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (screen === "review" && active) {
    return (
      <ReviewScreen
        session={active}
        entryById={entryById}
        onBack={() => setScreen("home")}
        onStart={() => setScreen("run")}
      />
    );
  }
  if (screen === "run" && active) {
    return (
      <RunScreen
        session={active}
        entryById={entryById}
        onSession={upsertSession}
        onEntryUpdated={onEntryUpdated}
        onFinish={() => setScreen("summary")}
        onExit={() => setScreen("home")}
      />
    );
  }
  if (screen === "summary" && active) {
    return (
      <SummaryScreen
        session={active}
        previous={active.repeatOf ? sessions.find((s) => s.id === active.repeatOf) ?? null : null}
        onRepeat={() =>
          createSession({
            entryIds: active.entryIds,
            name: active.name,
            source: active.source,
            contextAppId: active.selectedApplicationId,
            repeatOf: active.id,
            setId: active.setId,
          })
        }
        onDone={() => setScreen("home")}
      />
    );
  }

  return (
    <HomeScreen
      entries={entries}
      applications={applications}
      sessions={sessions}
      lastScore={lastScore}
      onStart={createSession}
      onOpen={(s) => {
        setActive(s);
        setScreen(s.status === "completed" ? "summary" : "run");
      }}
      onRepeat={(s) =>
        createSession({
          entryIds: s.entryIds,
          name: s.name,
          source: s.source,
          contextAppId: s.selectedApplicationId,
          repeatOf: s.id,
          setId: s.setId,
        })
      }
      onDelete={deleteSession}
    />
  );
}

// ---- Home: build a set + history ----
function HomeScreen({
  entries,
  applications,
  sessions,
  lastScore,
  onStart,
  onOpen,
  onRepeat,
  onDelete,
}: {
  entries: InterviewCoachEntry[];
  applications: PracticeAppOption[];
  sessions: PracticeSession[];
  lastScore: Map<string, { score: number; at: string }>;
  onStart: (opts: {
    entryIds: string[];
    name: string;
    source: string;
    contextAppId: string;
    review?: boolean;
  }) => Promise<void>;
  onOpen: (s: PracticeSession) => void;
  onRepeat: (s: PracticeSession) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("interviewCoach.practice");
  const locale = useLocale();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [contextAppId, setContextAppId] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [weakOnly, setWeakOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWeak = (e: InterviewCoachEntry) =>
    (lastScore.get(e.id)?.score ?? 99) < 6 || (e.gaps?.length ?? 0) > 0;

  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.category))].sort(),
    [entries]
  );

  const visible = useMemo(
    () =>
      entries.filter((e) => {
        if (catFilter && e.category !== catFilter) return false;
        if (appFilter && e.selectedApplicationId !== appFilter) return false;
        if (weakOnly && !isWeak(e)) return false;
        return true;
      }),
    [entries, catFilter, appFilter, weakOnly] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const selectVisible = () => setSelected(new Set(visible.map((e) => e.id)));
  const clearSel = () => setSelected(new Set());

  async function go(review: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    const source = weakOnly ? t("srcWeak") : catFilter || appFilter ? t("srcFiltered") : t("srcManual");
    setBusy(true);
    setError(null);
    try {
      await onStart({
        entryIds: ids,
        name: name.trim() || t("defaultName"),
        source,
        contextAppId,
        review,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Build a set */}
      <Card>
        <h2 className="mb-3 font-semibold text-foreground">{t("buildSetTitle")}</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noQuestions")}</p>
        ) : (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>{t("setName")}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("contextApp")}</label>
                <select value={contextAppId} onChange={(e) => setContextAppId(e.target.value)} className={inputClass}>
                  <option value="">{t("noContext")}</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.jobTitle} — {a.company}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("filterCategory")}</label>
                <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={inputClass}>
                  <option value="">{t("all")}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("filterApplication")}</label>
                <select value={appFilter} onChange={(e) => setAppFilter(e.target.value)} className={inputClass}>
                  <option value="">{t("all")}</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.jobTitle} — {a.company}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setWeakOnly((v) => !v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  weakOnly
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                {t("weakAreasOnly")}
              </button>
              <button type="button" onClick={selectVisible} className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
                {t("selectAll")}
              </button>
              <button type="button" onClick={clearSel} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                {t("clear")}
              </button>
              <span className="ml-auto text-xs text-muted-foreground">
                {t("selectedCount", { n: selected.size })}
              </span>
            </div>

            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-input p-2">
              {visible.map((e) => (
                <li key={e.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="text-foreground">{e.question}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{e.category}</span>
                      {isWeak(e) && (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                          {t("weak")}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => go(true)}
                disabled={busy || selected.size === 0}
                className={buttonClass("secondary")}
              >
                {t("review")}
              </button>
              <button
                type="button"
                onClick={() => go(false)}
                disabled={busy || selected.size === 0}
                className={buttonClass("primary")}
              >
                {busy ? t("starting") : t("startPractice")}
              </button>
            </div>
          </>
        )}
      </Card>

      {/* History */}
      <Card>
        <h2 className="mb-3 font-semibold text-foreground">{t("historyTitle")}</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString(locale)} · {s.entryIds.length}{" "}
                    {t("questionsWord")} ·{" "}
                    {s.status === "completed" ? t("completed") : t("inProgress")}
                    {s.repeatOf ? ` · ${t("isRepeat")}` : ""}
                  </p>
                </div>
                {s.overallScore > 0 && (
                  <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-200">
                    {t("score")}: {s.overallScore}/10
                  </span>
                )}
                <div className="flex gap-1">
                  <button type="button" onClick={() => onOpen(s)} className="rounded-md border border-input px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent">
                    {t("open")}
                  </button>
                  <button type="button" onClick={() => onRepeat(s)} className="rounded-md border border-input px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent">
                    {t("repeat")}
                  </button>
                  <button type="button" onClick={() => onDelete(s.id)} className="rounded-md border border-input px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                    {t("deleteAction")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---- Review (read-only pre-practice) ----
function ReviewScreen({
  session,
  entryById,
  onBack,
  onStart,
}: {
  session: PracticeSession;
  entryById: Map<string, InterviewCoachEntry>;
  onBack: () => void;
  onStart: () => void;
}) {
  const t = useTranslations("interviewCoach.practice");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">{t("reviewTitle")}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className={buttonClass("secondary")}>
            {t("back")}
          </button>
          <button type="button" onClick={onStart} className={buttonClass("primary")}>
            {t("startPractice")}
          </button>
        </div>
      </div>
      {session.entryIds.map((id) => {
        const e = entryById.get(id);
        if (!e) return null;
        return (
          <Card key={id}>
            <p className="font-medium text-foreground">{e.question}</p>
            <div className="mt-3 space-y-3 text-sm">
              <Field label={e.status === "final" ? t("finalAnswer") : t("savedAnswer")}>
                {e.answer || <span className="text-muted-foreground">{t("noAnswerYet")}</span>}
              </Field>
              {e.evidenceUsed.length > 0 && (
                <Field label={t("evidenceUsed")}>{e.evidenceUsed.join("; ")}</Field>
              )}
              {(e.journalStoriesUsed?.length ?? 0) > 0 && (
                <Field label={t("linkedStories")}>{e.journalStoriesUsed!.join(", ")}</Field>
              )}
              {e.gaps.length > 0 && (
                <Field label={t("gaps")}>
                  <ul className="list-disc pl-4">
                    {e.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </Field>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 whitespace-pre-wrap text-foreground/90">{children}</div>
    </div>
  );
}

// ---- Run (one question at a time) ----
function RunScreen({
  session,
  entryById,
  onSession,
  onEntryUpdated,
  onFinish,
  onExit,
}: {
  session: PracticeSession;
  entryById: Map<string, InterviewCoachEntry>;
  onSession: (s: PracticeSession) => void;
  onEntryUpdated: (e: InterviewCoachEntry) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const t = useTranslations("interviewCoach.practice");
  const locale = useLocale();
  const [i, setI] = useState(0);
  const attempt = session.attempts[i];
  const [draft, setDraft] = useState(attempt?.practiceAnswer ?? "");
  const [busy, setBusy] = useState<"save" | "grade" | "accept" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Voice dictation: append finalized speech to the answer. Degrades silently
  // (button hidden) when the browser has no Web Speech API.
  const { supported, listening, start, stop } = useSpeechToText({
    lang: SPEECH_LANG[locale] ?? "en-US",
    onFinal: (text) => setDraft((d) => (d ? d.replace(/\s+$/, "") + " " : "") + text),
  });

  // Reset the draft (and stop dictation) when navigating to another question.
  useEffect(() => {
    stop();
    setDraft(session.attempts[i]?.practiceAnswer ?? "");
    setError(null);
    setAccepted(false);
  }, [i, session.attempts, stop]);

  const total = session.attempts.length;

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/interview-practice/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [{ entryId: attempt.entryId, practiceAnswer: draft }] }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || t("requestFailed"));
      onSession(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function grade() {
    setBusy("grade");
    setError(null);
    try {
      const res = await fetch("/api/ai/interview-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, entryId: attempt.entryId, practiceAnswer: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("requestFailed"));
      onSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function acceptSuggestion(suggested: string) {
    setBusy("accept");
    setError(null);
    try {
      const res = await fetch(`/api/interview-coach/${attempt.entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appendRevision: { action: "practice", instruction: t("acceptInstruction"), after: suggested },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || t("requestFailed"));
      onEntryUpdated(await res.json());
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    await fetch(`/api/interview-practice/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s) onSession(s);
      })
      .catch(() => {});
    onFinish();
  }

  if (!attempt) return null;
  const entry = entryById.get(attempt.entryId);
  const feedback = attempt.feedback;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {t("questionN", { n: i + 1, total })}
        </p>
        <button type="button" onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground">
          {t("exit")}
        </button>
      </div>

      <Card>
        <p className="font-semibold text-foreground">{attempt.question}</p>
        {entry && entry.category && (
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.category}</p>
        )}

        <div className="mt-4 mb-1 flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-foreground/80">{t("yourAnswer")}</label>
          {supported && (
            <button
              type="button"
              onClick={() => (listening ? stop() : start())}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                listening
                  ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                  : "border-input text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className={listening ? "animate-pulse" : ""} aria-hidden>
                🎙
              </span>
              {listening ? t("voiceListening") : t("voiceStart")}
            </button>
          )}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder={t("answerPlaceholder")}
          className={inputClass}
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={busy !== null || !draft.trim()} className={buttonClass("secondary")}>
            {busy === "save" ? t("saving") : t("save")}
          </button>
          <button type="button" onClick={grade} disabled={busy !== null || draft.trim().length < 10} className={buttonClass("primary")}>
            {busy === "grade" ? t("grading") : t("getFeedback")}
          </button>
        </div>
      </Card>

      {feedback && (
        <FeedbackCard
          feedback={feedback}
          accepted={accepted}
          accepting={busy === "accept"}
          onAccept={() => acceptSuggestion(feedback.suggestedAnswer)}
        />
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className={buttonClass("secondary")}>
          {t("prev")}
        </button>
        {i < total - 1 ? (
          <button type="button" onClick={() => setI((v) => Math.min(total - 1, v + 1))} className={buttonClass("secondary")}>
            {t("next")}
          </button>
        ) : (
          <button type="button" onClick={finish} className={buttonClass("primary")}>
            {t("finish")}
          </button>
        )}
      </div>
    </div>
  );
}

function FeedbackCard({
  feedback,
  accepted,
  accepting,
  onAccept,
}: {
  feedback: PracticeFeedback;
  accepted: boolean;
  accepting: boolean;
  onAccept: () => void;
}) {
  const t = useTranslations("interviewCoach.practice");
  const dims: [string, number | undefined][] = [
    [t("dimClarity"), feedback.clarity],
    [t("dimRelevance"), feedback.relevance],
    [t("dimStructure"), feedback.structure],
    [t("dimStar"), feedback.starQuality],
    [t("dimConfidence"), feedback.confidence],
    [t("dimTechnical"), feedback.technicalAccuracy],
  ];
  const matched: [string, boolean][] = [
    [t("matchBaseResume"), feedback.matched.baseResume],
    [t("matchWorkJournal"), feedback.matched.workJournal],
    [t("matchSelectedResume"), feedback.matched.selectedResume],
    [t("matchApplication"), feedback.matched.application],
    [t("matchJobDescription"), feedback.matched.jobDescription],
  ];
  return (
    <Card className="border-brand-200 dark:border-brand-800">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">{t("feedbackTitle")}</p>
        <span className="rounded-full bg-brand-500/15 px-3 py-1 text-sm font-bold text-brand-700 dark:text-brand-200">
          {t("overall")}: {feedback.overall}/10
        </span>
      </div>

      <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {dims
          .filter(([, v]) => typeof v === "number")
          .map(([label, v]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${(v as number) <= 4 ? "bg-amber-500" : "bg-gradient-to-r from-brand-600 to-brand-400"}`}
                  style={{ width: `${(v as number) * 10}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-muted-foreground">{v}/10</span>
            </div>
          ))}
      </div>

      <div className="mt-4 space-y-3">
        <PointList title={t("goodPoints")} items={feedback.goodPoints} tone="emerald" />
        <PointList title={t("improvementPoints")} items={feedback.improvementPoints} tone="amber" />
        <PointList title={t("missingPoints")} items={feedback.missingPoints} tone="red" />
        {feedback.journalEvidenceToStrengthen.length > 0 && (
          <PointList title={t("strengthenWith")} items={feedback.journalEvidenceToStrengthen} tone="brand" />
        )}
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("matchedTitle")}</p>
        <div className="flex flex-wrap gap-1.5">
          {matched.map(([label, ok]) => (
            <span
              key={label}
              className={`rounded-full px-2 py-0.5 text-xs ${
                ok
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground line-through"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {feedback.suggestedAnswer && (
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("suggestedAnswer")}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{feedback.suggestedAnswer}</p>
          <div className="mt-2">
            {accepted ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ {t("accepted")}</span>
            ) : (
              <button type="button" onClick={onAccept} disabled={accepting} className={buttonClass("secondary")}>
                {accepting ? t("saving") : t("acceptSuggestion")}
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function PointList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber" | "red" | "brand";
}) {
  if (items.length === 0) return null;
  const dot =
    tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : tone === "red" ? "bg-red-500" : "bg-brand-500";
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
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

// ---- Summary (+ comparison vs previous attempt) ----
function SummaryScreen({
  session,
  previous,
  onRepeat,
  onDone,
}: {
  session: PracticeSession;
  previous: PracticeSession | null;
  onRepeat: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("interviewCoach.practice");
  const [busy, setBusy] = useState(false);

  const prevByEntry = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of previous?.attempts ?? []) if (a.feedback) m.set(a.entryId, a.feedback.overall);
    return m;
  }, [previous]);

  const graded = session.attempts.filter((a) => a.feedback);
  const prevOverall = previous?.overallScore ?? 0;
  const delta = previous ? Math.round((session.overallScore - prevOverall) * 10) / 10 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">{t("summaryTitle")}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              try {
                await onRepeat();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className={buttonClass("secondary")}
          >
            {t("repeat")}
          </button>
          <button type="button" onClick={onDone} className={buttonClass("primary")}>
            {t("done")}
          </button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-bold text-foreground">{session.overallScore}/10</span>
          <span className="text-sm text-muted-foreground">{t("avgOverall")}</span>
          {delta !== null && (
            <DeltaBadge delta={delta} t={t} suffix={t("vsPrevious")} />
          )}
        </div>
        {previous === null && (
          <p className="mt-2 text-sm text-muted-foreground">{t("firstAttempt")}</p>
        )}
        {graded.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">{t("noneGraded")}</p>
        )}
      </Card>

      {graded.length > 0 && (
        <Card>
          <p className="mb-3 font-semibold text-foreground">{t("perQuestion")}</p>
          <ul className="space-y-2">
            {graded.map((a) => {
              const prev = prevByEntry.get(a.entryId);
              const d = prev !== undefined ? Math.round((a.feedback!.overall - prev) * 10) / 10 : null;
              return (
                <li key={a.entryId} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground/90">{a.question}</span>
                  <span className="shrink-0 text-muted-foreground">{a.feedback!.overall}/10</span>
                  {d !== null && <DeltaBadge delta={d} t={t} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function DeltaBadge({
  delta,
  t,
  suffix,
}: {
  delta: number;
  t: ReturnType<typeof useTranslations>;
  suffix?: string;
}) {
  const up = delta > 0;
  const flat = delta === 0;
  const cls = flat
    ? "bg-muted text-muted-foreground"
    : up
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : "bg-red-500/15 text-red-700 dark:text-red-300";
  const label = flat ? t("noChange") : `${up ? "▲" : "▼"} ${Math.abs(delta)}`;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}
