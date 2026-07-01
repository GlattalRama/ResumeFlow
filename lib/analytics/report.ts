// Dashboard aggregation: read counter series for a period, derive totals for
// the selected window, plus active-user counts and an all-time country breakdown.

import { recentBucketKeys, storageKey } from "./buckets";
import { getStore, type CounterDoc } from "./store";
import {
  EXPORT_FORMATS,
  type AnalyticsEventType,
  type ExportFormat,
  type Period,
} from "./types";

export type SimpleSeries = number[];
export type ExportSeries = { total: number[] } & Record<ExportFormat, number[]>;

export interface CountryCount {
  code: string;
  count: number;
}

export interface AnalyticsReport {
  period: Period;
  buckets: string[]; // x-axis labels, oldest first
  series: {
    login: SimpleSeries;
    resume_created: SimpleSeries;
    application_created: SimpleSeries;
    ai_tailored: SimpleSeries;
    resume_exported: ExportSeries;
    activeUsers: SimpleSeries; // distinct users per bucket
  };
  totals: {
    login: number;
    resume_created: number;
    application_created: number;
    ai_tailored: number;
    resume_exported: { total: number } & Record<ExportFormat, number>;
    activeUsers: number; // distinct users across the selected window
  };
  countries: CountryCount[]; // all-time logins by country, desc
}

// Count distinct keys under a prefix — each `uu|period|bucket|<token>` key is one
// distinct user, so the key count is the distinct-user count for that bucket.
function countPrefix(doc: CounterDoc, prefix: string): number {
  let n = 0;
  for (const k in doc) if (k.startsWith(prefix)) n++;
  return n;
}

// Distinct users across several buckets: union the `<token>` parts so a user
// active in more than one bucket is counted once (summing per-bucket counts
// would double-count them).
function distinctUsersAcross(
  doc: CounterDoc,
  period: Period,
  buckets: string[]
): number {
  const seen = new Set<string>();
  for (const b of buckets) {
    const prefix = `uu|${period}|${b}|`;
    for (const k in doc) if (k.startsWith(prefix)) seen.add(k.slice(prefix.length));
  }
  return seen.size;
}

const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

export async function getReport(
  period: Period,
  range: number,
  now = new Date()
): Promise<AnalyticsReport> {
  const buckets = recentBucketKeys(period, range, now);
  const doc = await getStore().snapshot();
  const at = (k: string) => doc[k] ?? 0;

  const simpleSeries = (ev: AnalyticsEventType): number[] =>
    buckets.map((b) => at(storageKey(ev, period, b)));

  const loginSeries = simpleSeries("login");
  const resumeCreatedSeries = simpleSeries("resume_created");
  const applicationCreatedSeries = simpleSeries("application_created");
  const aiTailoredSeries = simpleSeries("ai_tailored");

  // Exports per format + total, per bucket.
  const exportSeries = { total: buckets.map(() => 0) } as ExportSeries;
  for (const fmt of EXPORT_FORMATS) {
    exportSeries[fmt] = buckets.map((b) =>
      at(storageKey("resume_exported", period, b, fmt))
    );
  }
  exportSeries.total = buckets.map((_, i) =>
    EXPORT_FORMATS.reduce((s, fmt) => s + exportSeries[fmt][i], 0)
  );

  // Totals reflect the selected period + range window: sum each metric's
  // visible per-bucket series rather than reading the all-time counter.
  const exportTotals = { total: 0 } as { total: number } & Record<ExportFormat, number>;
  for (const fmt of EXPORT_FORMATS) {
    exportTotals[fmt] = sum(exportSeries[fmt]);
  }
  exportTotals.total = EXPORT_FORMATS.reduce((s, fmt) => s + exportTotals[fmt], 0);

  // Active (distinct) users: count `uu|period|bucket|<token>` keys per bucket,
  // and union tokens across the window for the total.
  const activeUsers = buckets.map((b) => countPrefix(doc, `uu|${period}|${b}|`));
  const activeUsersTotal = distinctUsersAcross(doc, period, buckets);

  // All-time logins by country, descending.
  const countryPrefix = "country|all|all|";
  const countries: CountryCount[] = Object.keys(doc)
    .filter((k) => k.startsWith(countryPrefix))
    .map((k) => ({ code: k.slice(countryPrefix.length), count: doc[k] }))
    .filter((c) => c.code && c.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    period,
    buckets,
    series: {
      login: loginSeries,
      resume_created: resumeCreatedSeries,
      application_created: applicationCreatedSeries,
      ai_tailored: aiTailoredSeries,
      resume_exported: exportSeries,
      activeUsers,
    },
    totals: {
      login: sum(loginSeries),
      resume_created: sum(resumeCreatedSeries),
      application_created: sum(applicationCreatedSeries),
      ai_tailored: sum(aiTailoredSeries),
      resume_exported: exportTotals,
      activeUsers: activeUsersTotal,
    },
    countries,
  };
}
