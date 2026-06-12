"use client";

import type { TailorChange, DiffPart } from "@/lib/tailorDiff";
import { diffWords } from "@/lib/tailorDiff";
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

function ChangeBody({ change }: { change: TailorChange }) {
  if (change.kind === "text") {
    return <DiffText parts={diffWords(change.before, change.after)} />;
  }
  if (change.kind === "bullets") {
    return (
      <ul className="space-y-1.5">
        {change.pairs.map((pair, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-0.5 text-muted-foreground/70" aria-hidden>
              •
            </span>
            {pair.before != null && pair.after != null ? (
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
          </li>
        ))}
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
          Dropped as less relevant:{" "}
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

export function TailorChangeCard({
  change,
  rejected,
  onToggle,
}: {
  change: TailorChange;
  rejected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 transition ${
        rejected ? "border-border bg-muted/50 opacity-60" : "border-border bg-card"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground/80">
          {change.section}
        </p>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-input text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => rejected && onToggle()}
            aria-pressed={!rejected}
            className={`px-2 py-1 transition ${
              rejected
                ? "bg-card text-muted-foreground hover:bg-muted/50"
                : "bg-green-600 text-white"
            }`}
          >
            ✓ Accept
          </button>
          <button
            type="button"
            onClick={() => !rejected && onToggle()}
            aria-pressed={rejected}
            className={`px-2 py-1 transition ${
              rejected
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Keep original
          </button>
        </div>
      </div>
      {change.reason && (
        <p className="mb-2 text-[11px] italic leading-snug text-muted-foreground">
          {change.reason}
        </p>
      )}
      <ChangeBody change={change} />
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
            ATS score{" "}
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
              Keywords {before.matchedCount}/{before.keywords.length} →{" "}
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
