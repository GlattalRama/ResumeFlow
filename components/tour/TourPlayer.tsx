"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";

export type TourCue = {
  start: number;
  end: number;
  chapter: string;
  title: Record<string, string>;
  text: Record<string, string>;
};
export type TourChapter = { id: string; start: number };

const CHAPTER_KEYS = ["start", "resumes", "applications", "interviews", "journal", "end"] as const;
type ChapterKey = (typeof CHAPTER_KEYS)[number];

function clock(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/**
 * The recorded product tour (scripts/tour/record-tour.mjs) with chapter
 * navigation and captions in the viewer's language. Skip jumps to the next
 * chapter, Esc leaves, and the end screen points to sign-in.
 */
export default function TourPlayer({
  cues,
  chapters,
  duration,
  locale,
  exitHref,
}: {
  cues: TourCue[];
  chapters: TourChapter[];
  duration: number;
  locale: string;
  exitHref: string;
}) {
  const t = useTranslations("tour");
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  const pick = (m: Record<string, string>) => m[locale] ?? m.en;
  const chapterName = (id: string) =>
    (CHAPTER_KEYS as readonly string[]).includes(id) ? t(`chapters.${id as ChapterKey}`) : id;
  const cue = cues.find((c) => time >= c.start && time < c.end);
  const currentChapter = [...chapters].reverse().find((c) => time >= c.start) ?? chapters[0];

  const seek = (s: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = s;
    setEnded(false);
    void v.play();
  };
  const skip = () => {
    const next = chapters.find((c) => c.start > time + 0.5);
    if (next) seek(next.start);
    else {
      video.current?.pause();
      setEnded(true);
    }
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, button, video")) return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") skip();
      else if (e.key === "ArrowLeft") {
        const prev = [...chapters].reverse().find((c) => c.start < time - 2);
        seek(prev ? prev.start : 0);
      } else if (e.key === "Escape") router.push(exitHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const button =
    "inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-accent";

  if (ended) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">{t("finishedTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("finishedText")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signin"
            className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            {t("getStarted")}
          </Link>
          <button type="button" onClick={() => seek(0)} className={button}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t("restart")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="min-w-0">
        <div className="relative overflow-hidden rounded-xl border border-border bg-black shadow-sm">
          <video
            ref={video}
            className="aspect-[16/10] w-full"
            poster="/tour/poster.webp"
            autoPlay
            muted
            playsInline
            controls
            preload="auto"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setEnded(true)}
          >
            <source src="/tour/demo.mp4" type="video/mp4" />
          </video>
          {cue && (
            <div
              aria-live="polite"
              className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-3 sm:bottom-16"
            >
              <div className="max-w-2xl rounded-xl bg-[#0a0f1a]/90 px-4 py-2.5 text-white shadow-lg sm:px-5 sm:py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 sm:text-[11px]">
                  {chapterName(cue.chapter)}
                </p>
                <p className="text-sm font-semibold sm:text-base">{pick(cue.title)}</p>
                <p className="mt-0.5 hidden text-sm leading-snug text-white/85 sm:block">{pick(cue.text)}</p>
              </div>
            </div>
          )}
        </div>
        {/* On phones the caption body is hidden inside the video; show it below instead. */}
        {cue && <p className="mt-2 text-sm text-muted-foreground sm:hidden">{pick(cue.text)}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggle} className={button}>
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {playing ? t("pause") : t("play")}
          </button>
          <button
            type="button"
            onClick={skip}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            {t("skip")}
          </button>
          <Link href={exitHref} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent">
            <X className="h-4 w-4" aria-hidden="true" />
            {t("exit")}
          </Link>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {currentChapter && chapterName(currentChapter.id)} · {clock(time)} / {clock(duration)}
          </span>
        </div>
        <p className="mt-2 hidden text-xs text-muted-foreground/70 sm:block">{t("keys")}</p>
      </div>

      <aside>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("chaptersLabel")}</p>
        <ol className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {chapters.map((c) => {
            const active = currentChapter?.id === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => seek(c.start)}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full items-baseline justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                    active ? "bg-brand-600 text-white" : "text-foreground/80 hover:bg-accent"
                  }`}
                >
                  <span>{chapterName(c.id)}</span>
                  <span className={`text-xs tabular-nums ${active ? "text-white/80" : "text-muted-foreground"}`}>
                    {clock(c.start)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
