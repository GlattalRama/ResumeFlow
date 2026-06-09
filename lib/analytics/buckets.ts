// Time-bucket key math for analytics counters.
//
// All keys are computed in UTC so totals are stable regardless of the server
// region. A counter is stored under a flat string key:
//
//     "{eventType}|{period}|{bucketKey}|{dimension}"
//
// where `dimension` is the export format for `resume_exported`, otherwise "".

import type { AnalyticsEvent, Period } from "./types";

// ---- single-period bucket keys (UTC) -------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ISO-8601 week: weeks start Monday; week 1 contains the year's first Thursday.
// Returns { year, week } where `year` is the ISO week-year (may differ from the
// calendar year at year boundaries).
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  // Thursday of the current week decides the year.
  const day = d.getUTCDay() || 7; // Sun=0 -> 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year, week };
}

export function bucketKey(period: Period, date: Date): string {
  switch (period) {
    case "all":
      return "all";
    case "year":
      return String(date.getUTCFullYear());
    case "month":
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
    case "day":
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
        date.getUTCDate()
      )}`;
    case "week": {
      const { year, week } = isoWeek(date);
      return `${year}-W${pad(week)}`;
    }
  }
}

// ---- storage keys ---------------------------------------------------------

export function storageKey(
  eventType: string,
  period: Period,
  bucket: string,
  dimension = ""
): string {
  return `${eventType}|${period}|${bucket}|${dimension}`;
}

const ALL_PERIODS: Period[] = ["day", "week", "month", "year", "all"];

// Every counter key a single event should increment: one per period, in the
// event's own bucket.
export function bucketKeysForEvent(event: AnalyticsEvent, date: Date): string[] {
  const dimension = event.type === "resume_exported" ? event.format : "";
  return ALL_PERIODS.map((p) => storageKey(event.type, p, bucketKey(p, date), dimension));
}

// Generic per-period keys for a custom metric + dimension (used for the
// `uu` unique-user tokens and the `country` breakdown).
export function periodKeys(
  metric: string,
  dimension: string,
  date: Date
): string[] {
  return ALL_PERIODS.map((p) => storageKey(metric, p, bucketKey(p, date), dimension));
}

// ---- reading recent buckets (for the dashboard) ---------------------------

// The N most recent bucket keys for a period, oldest first, ending at `now`.
// `all` collapses to a single bucket.
export function recentBucketKeys(period: Period, n: number, now: Date): string[] {
  if (period === "all") return ["all"];
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(bucketKey(period, stepBack(period, now, i)));
  }
  return keys;
}

// `now` shifted back by `count` units of `period` (UTC).
function stepBack(period: Period, now: Date, count: number): Date {
  const d = new Date(now.getTime());
  switch (period) {
    case "day":
      d.setUTCDate(d.getUTCDate() - count);
      break;
    case "week":
      d.setUTCDate(d.getUTCDate() - count * 7);
      break;
    case "month":
      d.setUTCMonth(d.getUTCMonth() - count);
      break;
    case "year":
      d.setUTCFullYear(d.getUTCFullYear() - count);
      break;
    case "all":
      break;
  }
  return d;
}
