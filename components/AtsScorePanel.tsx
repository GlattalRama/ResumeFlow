"use client";

import type { AtsScoreResult } from "@/lib/atsScore";

// Color band for a 0–100 score: red < 50 ≤ amber < 75 ≤ green.
export function scoreBandClass(value: number): string {
  if (value >= 75) return "text-green-600 dark:text-green-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// Circular score gauge. Inherits its band color via scoreBandClass.
export function ScoreRing({
  value,
  size = 48,
}: {
  value: number;
  size?: number;
}) {
  const stroke = Math.max(3, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${scoreBandClass(value)}`}
      role="img"
      aria-label={`ATS score ${value} of 100`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        stroke="currentColor"
        strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-current font-bold"
        style={{ fontSize: size * 0.34 }}
      >
        {value}
      </text>
    </svg>
  );
}

const STATUS_ICON = {
  pass: { char: "✓", cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
  warn: { char: "!", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  fail: { char: "✕", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
} as const;

// The ATS Score card body: overall gauge + subscores, the job-description
// input driving keyword match, keyword chips, and the health check list.
export default function AtsScorePanel({
  result,
  jobDescription,
  onJobDescriptionChange,
}: {
  result: AtsScoreResult;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Overall + subscores */}
      <div className="flex items-center gap-4">
        <ScoreRing value={result.overall} size={72} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {result.overall >= 75
              ? "Strong — ready for ATS portals"
              : result.overall >= 50
                ? "Getting there — work through the fixes below"
                : "Needs work — start with the failed checks"}
          </p>
          <p className="text-xs text-muted-foreground">
            Resume health{" "}
            <span className={`font-semibold ${scoreBandClass(result.healthScore)}`}>
              {result.healthScore}
            </span>
            {result.keywordScore != null && (
              <>
                {" · "}Job match{" "}
                <span
                  className={`font-semibold ${scoreBandClass(result.keywordScore)}`}
                >
                  {result.keywordScore}%
                </span>
              </>
            )}
            {result.keywordScore == null && (
              <> · paste a job description to add keyword match</>
            )}
          </p>
        </div>
      </div>

      {/* Job description input */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Job description
        </label>
        <textarea
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          rows={5}
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="Paste the job description here — keywords are extracted locally and matched against your resume as you type."
        />
      </div>

      {/* Keyword coverage */}
      {result.hasJobDescription && result.keywords.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Keywords: {result.matchedCount} of {result.keywords.length} covered
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.keywords.map(({ keyword, matched }) => (
              <span
                key={keyword}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  matched
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                }`}
                title={matched ? "Found in your resume" : "Not found in your resume"}
              >
                {matched ? "✓ " : ""}
                {keyword}
              </span>
            ))}
          </div>
          {result.matchedCount < result.keywords.length && (
            <p className="mt-1.5 text-xs text-muted-foreground/70">
              Weave missing keywords into your summary, skills, or bullets —
              but only where they're true.
            </p>
          )}
        </div>
      )}

      {/* Health checks */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Resume health checks
        </p>
        <ul className="space-y-1.5">
          {result.checks.map((check) => {
            const icon = STATUS_ICON[check.status];
            return (
              <li
                key={check.id}
                className="rounded-lg border border-border bg-muted/50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${icon.cls}`}
                      aria-hidden
                    >
                      {icon.char}
                    </span>
                    <span className="truncate text-sm text-foreground/80">
                      {check.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {check.points}/{check.maxPoints}
                  </span>
                </div>
                {check.tip && (
                  <p className="mt-1 pl-[26px] text-xs leading-snug text-muted-foreground">
                    {check.tip}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Advisories */}
      {result.advisories.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {result.advisories.map((a, i) => (
            <p key={i} className={i > 0 ? "mt-1" : ""}>
              {a}
            </p>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground/70">
        Scores are heuristic guidance computed locally — nothing is sent to a
        server. Different ATS vendors parse differently; the ATS-safe export is
        the safest format for portals.
      </p>
    </div>
  );
}
