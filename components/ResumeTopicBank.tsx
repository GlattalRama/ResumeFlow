"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  INTERVIEW_DIFFICULTIES,
  type InterviewCoachEntry,
  type InterviewDifficulty,
} from "@/lib/types";
import { Card, buttonClass } from "@/components/ui";
import { aiFetch } from "@/lib/aiConsentClient";

const inputClass =
  "w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const selectClass =
  "rounded-md border border-input bg-card text-foreground px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface ResumeOpt {
  id: string;
  name: string;
  isBase: boolean;
}

export default function ResumeTopicBank({
  resumes,
  baseResumeId,
  entries,
  onCreated,
}: {
  resumes: ResumeOpt[];
  baseResumeId: string;
  entries: InterviewCoachEntry[];
  onCreated: (created: InterviewCoachEntry[]) => void;
}) {
  const t = useTranslations("interviewCoach.topicBank");
  const [open, setOpen] = useState(false);
  const [resumeId, setResumeId] = useState(baseResumeId || resumes.find((r) => r.isBase)?.id || resumes[0]?.id || "");
  const [topics, setTopics] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<Record<string, InterviewDifficulty>>({});
  const [newTopic, setNewTopic] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [genTopic, setGenTopic] = useState<string | null>(null);
  // Generation requests run one at a time: the store rewrites the whole
  // collection per save, so parallel requests could drop each other's
  // questions. Clicks while busy join this queue instead of being blocked.
  const queueRef = useRef<{ topic: string; difficulty: InterviewDifficulty; resumeId: string }[]>([]);
  const runningRef = useRef(false);
  const [queued, setQueued] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Live counts per topic from the actual entries (case-insensitive).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      if (e.topic) m.set(e.topic.toLowerCase(), (m.get(e.topic.toLowerCase()) ?? 0) + 1);
    }
    return m;
  }, [entries]);

  // Topics seen in entries but not in the current list (so prior banks show up).
  const allTopics = useMemo(() => {
    const set = new Set(topics.map((x) => x.toLowerCase()));
    const extra: string[] = [];
    for (const e of entries) {
      if (e.topic && !set.has(e.topic.toLowerCase())) {
        set.add(e.topic.toLowerCase());
        extra.push(e.topic);
      }
    }
    return [...topics, ...extra];
  }, [topics, entries]);

  const diffFor = (topic: string) => difficulties[topic] ?? "senior";

  async function extract() {
    setExtracting(true);
    setError(null);
    setNote(null);
    try {
      const res = await aiFetch("/api/ai/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "topics", resumeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("requestFailed"));
      setTopics((prev) => {
        const seen = new Set(prev.map((x) => x.toLowerCase()));
        const merged = [...prev];
        for (const tp of data.topics as string[]) {
          if (!seen.has(tp.toLowerCase())) {
            seen.add(tp.toLowerCase());
            merged.push(tp);
          }
        }
        return merged;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setExtracting(false);
    }
  }

  function addTopic() {
    const tp = newTopic.trim();
    if (!tp) return;
    if (!topics.some((x) => x.toLowerCase() === tp.toLowerCase())) {
      setTopics((prev) => [...prev, tp]);
    }
    setNewTopic("");
  }

  function removeTopic(topic: string) {
    setTopics((prev) => prev.filter((x) => x !== topic));
  }

  function generate(topicList: string[]) {
    const pending = new Set(queueRef.current.map((q) => q.topic));
    if (genTopic) pending.add(genTopic);
    for (const topic of topicList) {
      if (pending.has(topic)) continue;
      pending.add(topic);
      queueRef.current.push({ topic, difficulty: diffFor(topic), resumeId });
    }
    setQueued(queueRef.current.map((q) => q.topic));
    if (!runningRef.current) void runQueue();
  }

  async function runQueue() {
    runningRef.current = true;
    setError(null);
    setNote(null);
    let added = 0;
    let skipped = 0;
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()!;
      setQueued(queueRef.current.map((q) => q.topic));
      setGenTopic(job.topic);
      try {
        const res = await aiFetch("/api/ai/interview-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "topic-questions",
            topic: job.topic,
            difficulty: job.difficulty,
            resumeId: job.resumeId,
            count: 8,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || t("requestFailed"));
        const created: InterviewCoachEntry[] = data.created ?? [];
        if (created.length > 0) onCreated(created);
        added += created.length;
        skipped += data.skipped ?? 0;
        setNote(
          skipped > 0
            ? t("created", { n: added, skipped })
            : t("createdNoSkip", { n: added })
        );
      } catch (err) {
        setError(`${job.topic}: ${err instanceof Error ? err.message : t("requestFailed")}`);
      }
    }
    setGenTopic(null);
    runningRef.current = false;
  }

  // "Generate all" covers topics that have no questions yet and aren't
  // already running or queued.
  const ungenerated = allTopics.filter(
    (tp) => (counts.get(tp.toLowerCase()) ?? 0) === 0 && tp !== genTopic && !queued.includes(tp)
  );

  return (
    <Card className="mb-4">
      {/* Chevron sits next to the title (not lost at the far edge) and the
          hint doubles as a collapsed subtitle, so the accordion reads as
          expandable at a glance. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="mt-0.5 text-muted-foreground" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">{t("title")}</span>
          {!open && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t("hint")}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">{t("hint")}</p>

          <div className="flex flex-wrap items-end gap-2">
            {resumes.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("resumeLabel")}</label>
                <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={selectClass}>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.isBase ? ` (${t("base")})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" onClick={extract} disabled={extracting} className={buttonClass("primary")}>
              {extracting ? t("extracting") : allTopics.length > 0 ? t("reExtract") : t("extract")}
            </button>
            {ungenerated.length > 0 && (
              <button type="button" onClick={() => generate(ungenerated)} className={buttonClass("secondary")}>
                {t("generateAll", { n: ungenerated.length })}
              </button>
            )}
          </div>

          {allTopics.length === 0 ? (
            <p className="rounded-md border border-dashed border-input p-3 text-sm text-muted-foreground">
              {t("topicsEmpty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {allTopics.map((topic) => {
                const n = counts.get(topic.toLowerCase()) ?? 0;
                const busy = genTopic === topic;
                const isQueued = queued.includes(topic);
                return (
                  <li
                    key={topic}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2.5"
                  >
                    <span className="font-medium text-foreground">{topic}</span>
                    {n > 0 && (
                      <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-200">
                        {t("count", { n })}
                      </span>
                    )}
                    <span className="flex-1" />
                    <select
                      value={diffFor(topic)}
                      onChange={(e) =>
                        setDifficulties((d) => ({ ...d, [topic]: e.target.value as InterviewDifficulty }))
                      }
                      className={selectClass}
                      aria-label={t("difficulty")}
                    >
                      {INTERVIEW_DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {t(`diff_${d}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => generate([topic])}
                      disabled={busy || isQueued}
                      className={buttonClass("secondary")}
                    >
                      {busy ? t("generating") : isQueued ? t("queued") : n > 0 ? t("more") : t("generate")}
                    </button>
                    {topics.includes(topic) && (
                      <button
                        type="button"
                        onClick={() => removeTopic(topic)}
                        aria-label={t("remove")}
                        className="rounded-md border border-input px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
              placeholder={t("addTopicPlaceholder")}
              className={`${inputClass} max-w-xs`}
            />
            <button type="button" onClick={addTopic} className={buttonClass("secondary")}>
              {t("add")}
            </button>
          </div>

          {note && <p className="text-sm text-emerald-600 dark:text-emerald-400">{note}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </Card>
  );
}
