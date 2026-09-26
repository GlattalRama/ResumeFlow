"use client";

import { useTranslations } from "next-intl";
import type { TailorChange, DiffPart } from "@/lib/tailorDiff";
import { bulletKey, diffWords } from "@/lib/tailorDiff";
import type { AtsScoreResult } from "@/lib/atsScore";
import { ScoreRing, scoreBandClass } from "./AtsScorePanel";

// Review UI for the tailoring flow: an ATS score delta header plus one
// accept/reject diff card per change. Pure presentation — choice state lives
// in TailorResumeFlow.

function DiffText({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="text-xs leading-relaxed text-foreground/80">
      {parts.map((part, i) =>
        part.type === "same" ? (
          <span key={i}> {part.text} </span>
        ) : part.type === "del" ? (
          <del
            key={i}
            className="rounded bg-red-100 px-0.5 text-red-700 dark:bg-red-950/60 dark:text-red-400"
          >
            {part.text}
          </del>
        ) : (
          <ins
            key={i}
            className="rounded bg-green-100 px-0.5 no-underline text-green-700 dark:bg-green-950/60 dark:text-green-300"
          >
            {part.text}
          </ins>
        )
      )}
    </p>
  );
}

// Small ✓ / ↩ toggle used per bullet and (larger) per card.
function AcceptToggle({
  rejected,
  onToggle,
  compact = false,
  acceptLabel,
  rejectLabel,
}: {
  rejected: boolean;
  onToggle: () => void;
  compact?: boolean;
  acceptLabel: string;
  rejectLabel: string;
}) {
  const pad = compact ? "px-1.5 py-0.5" : "px-2 py-1";
  return (
    <div
      className={`flex shrink-0 overflow-hidden rounded-md border border-input font-semibold ${
        compact ? "text-[10px]" : "text-[11px]"
      }`}
    >
      <button
        type="button"
        onClick={() => rejected && onToggle()}
        aria-pressed={!rejected}
        className={`${pad} transition ${
          rejected
            ? "bg-card text-muted-foreground hover:bg-muted/50"
            : "bg-green-600 text-white"
        }`}
      >
        ✓ {acceptLabel}
      </button>
      <button
        type="button"
        onClick={() => !rejected && onToggle()}
        aria-pressed={rejected}
        className={`${pad} transition ${
          rejected
            ? "bg-foreground text-background"
            : "bg-card text-muted-foreground hover:bg-muted/50"
        }`}
      >
        {rejectLabel}
      </button>
    </div>
  );
}

function ChangeBody({
  change,
  rejectedKeys,
  cardRejected,
  onToggle,
}: {
  change: TailorChange;
  rejectedKeys: ReadonlySet<string>;
  cardRejected: boolean;
  onToggle: (key: string) => void;
}) {
  const t = useTranslations("ai");
  if (change.kind === "text") {
    return <DiffText parts={diffWords(change.before, change.after)} />;
  }
  if (change.kind === "bullets") {
    const expIndex = Number(change.key.slice(4));
    return (
      <ul className="space-y-1.5">
        {change.pairs.map((pair, i) => {
          const changed = pair.before !== pair.after;
          const key = bulletKey(expIndex, i);
          const bulletRejected = rejectedKeys.has(key);
          // Show the bullet's original wording when just this bullet is kept.
          const showOriginal = !cardRejected && bulletRejected;
          return (
            <li
              key={i}
              className={`flex items-start gap-1.5 ${showOriginal ? "opacity-70" : ""}`}
            >
              <span className="mt-0.5 text-muted-foreground/70" aria-hidden>
                •
              </span>
              <div className="min-w-0 flex-1">
                {showOriginal ? (
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {pair.before}
                  </p>
                ) : pair.before != null && pair.after != null ? (
                  <DiffText parts={diffWords(pair.before, pair.after)} />
                ) : pair.before != null ? (
                  <del className="text-xs leading-relaxed text-red-700/80 dark:text-red-400/80">
                    {pair.before}
                  </del>
                ) : (
                  <ins className="text-xs leading-relaxed no-underline text-green-700 dark:text-green-300">
                    {pair.after}
                  </ins>
                )}
              </div>
              {/* Per-bullet choice — only for bullets the tailoring actually
                  changed, and only while the card as a whole is accepted. */}
              {changed && !cardRejected && (
                <AcceptToggle
                  compact
                  rejected={bulletRejected}
                  onToggle={() => onToggle(key)}
                  acceptLabel={t("tailor.accept")}
                  rejectLabel={t("tailor.keepOriginal")}
                />
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  // list reorder
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {change.after.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground/80"
          >
            {i + 1}. {item}
          </span>
        ))}
      </div>
      {change.dropped.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {t("tailor.dropped")}{" "}
          {change.dropped.map((item, i) => (
            <del key={item} className="text-red-700/70 dark:text-red-400/70">
              {i > 0 ? ", " : ""}
              {item}
            </del>
          ))}
        </p>
      )}
    </div>
  );
}

// One reviewable change. `rejectedKeys` holds every rejected choice key (the
// card's own key and, for experience cards, any per-bullet keys); `onToggle`
// flips one key. Choice state lives in TailorResumeFlow.
export function TailorChangeCard({
  change,
  rejectedKeys,
  onToggle,
}: {
  change: TailorChange;
  rejectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const t = useTranslations("ai");
  const rejected = rejectedKeys.has(change.key);
  // For experience cards: how many of the rewritten bullets are accepted.
  let bulletSummary: string | null = null;
  if (change.kind === "bullets" && !rejected) {
    const expIndex = Number(change.key.slice(4));
    const changedIdx = change.pairs
      .map((p, i) => (p.before !== p.after ? i : -1))
      .filter((i) => i >= 0);
    const kept = changedIdx.filter((i) => !rejectedKeys.has(bulletKey(expIndex, i))).length;
    if (changedIdx.length > 1) {
      bulletSummary = t("tailor.bulletsAccepted", { kept, total: changedIdx.length });
    }
  }
  return (
    <div
      className={`rounded-lg border p-3 transition ${
        rejected ? "border-border bg-muted/50 opacity-60" : "border-border bg-card"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground/80">
            {change.section}
          </p>
          {bulletSummary && (
            <p className="text-[11px] text-muted-foreground">{bulletSummary}</p>
          )}
        </div>
        <AcceptToggle
          rejected={rejected}
          onToggle={() => onToggle(change.key)}
          acceptLabel={t("tailor.accept")}
          rejectLabel={t("tailor.keepOriginal")}
        />
      </div>
      {change.reason && (
        <p className="mb-2 text-[11px] italic leading-snug text-muted-foreground">
          {change.reason}
        </p>
      )}
      <ChangeBody
        change={change}
        rejectedKeys={rejectedKeys}
        cardRejected={rejected}
        onToggle={onToggle}
      />
    </div>
  );
}

// "Before → after" ATS score header. The after-score reflects the user's
// current accept/reject choices, so toggling cards moves it live.
export function ScoreDelta({
  before,
  after,
}: {
  before: AtsScoreResult;
  after: AtsScoreResult;
}) {
  const t = useTranslations("ai");
  const delta = after.overall - before.overall;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex items-center gap-3">
        <ScoreRing value={before.overall} size={40} />
        <span className="text-muted-foreground/70" aria-hidden>
          →
        </span>
        <ScoreRing value={after.overall} size={40} />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("tailor.atsScore")}{" "}
            <span
              className={
                delta > 0
                  ? "text-green-600 dark:text-green-400"
                  : delta < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              }
            >
              {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
            </span>
          </p>
          {before.hasJobDescription && (
            <p className="text-[11px] text-muted-foreground">
              {t("tailor.keywords")} {before.matchedCount}/{before.keywords.length} →{" "}
              <span className={scoreBandClass(after.keywordScore ?? 0)}>
                {after.matchedCount}/{after.keywords.length}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
