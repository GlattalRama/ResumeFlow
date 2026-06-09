// Dashboard aggregation: read counter series for a period + all-time totals,
// plus active-user counts and a country breakdown.

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
    activeUsers: number; // all-time distinct users
  };
  countries: CountryCount[]; // all-time logins by country, desc
}

const SIMPLE_EVENTS: Exclude<AnalyticsEventType, "resume_exported">[] = [
  "login",
  "resume_created",
  "application_created",
  "ai_tailored",
];

// Count distinct keys under a prefix — each `uu|period|bucket|<token>` key is one
// distinct user, so the key count is the distinct-user count for that bucket.
function countPrefix(doc: CounterDoc, prefix: string): number {
  let n = 0;
  for (const k in doc) if (k.startsWith(prefix)) n++;
  return n;
}

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

  // Exports per format + total, per bucket.
  const exportSeries = { total: buckets.map(() => 0) } as ExportSeries;
  for (const fmt of EXPORT_FORMATS) {
    exportSeries[fmt] = buckets.map((b) =>
      at(storageKey("resume_exported", period, b, fmt))
    );
  }
  exportSeries.total = buckets.map((_, i) =>
    EXPORT_FORMATS.reduce((sum, fmt) => sum + exportSeries[fmt][i], 0)
  );

  const exportTotals = { total: 0 } as { total: number } & Record<ExportFormat, number>;
  for (const fmt of EXPORT_FORMATS) {
    exportTotals[fmt] = at(storageKey("resume_exported", "all", "all", fmt));
  }
  exportTotals.total = EXPORT_FORMATS.reduce((s, fmt) => s + exportTotals[fmt], 0);

  // Active (distinct) users: count `uu|period|bucket|<token>` keys per bucket.
  const activeUsers = buckets.map((b) => countPrefix(doc, `uu|${period}|${b}|`));
  const activeUsersTotal = countPrefix(doc, "uu|all|all|");

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
      login: simpleSeries("login"),
      resume_created: simpleSeries("resume_created"),
      application_created: simpleSeries("application_created"),
      ai_tailored: simpleSeries("ai_tailored"),
      resume_exported: exportSeries,
      activeUsers,
    },
    totals: {
      login: at(storageKey("login", "all", "all")),
      resume_created: at(storageKey("resume_created", "all", "all")),
      application_created: at(storageKey("application_created", "all", "all")),
      ai_tailored: at(storageKey("ai_tailored", "all", "all")),
      resume_exported: exportTotals,
      activeUsers: activeUsersTotal,
    },
    countries,
  };
}
