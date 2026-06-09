// Dashboard aggregation: read counter series for a period + all-time totals.

import { recentBucketKeys, storageKey } from "./buckets";
import { getStore } from "./store";
import {
  ANALYTICS_EVENT_TYPES,
  EXPORT_FORMATS,
  type AnalyticsEventType,
  type ExportFormat,
  type Period,
} from "./types";

// Per-period series for one simple (no-dimension) event.
export type SimpleSeries = number[];

// resume_exported is split by format, plus a `total` across formats.
export type ExportSeries = { total: number[] } & Record<ExportFormat, number[]>;

export interface AnalyticsReport {
  period: Period;
  buckets: string[]; // x-axis labels, oldest first
  series: {
    login: SimpleSeries;
    resume_created: SimpleSeries;
    application_created: SimpleSeries;
    ai_tailored: SimpleSeries;
    resume_exported: ExportSeries;
  };
  totals: {
    login: number;
    resume_created: number;
    application_created: number;
    ai_tailored: number;
    resume_exported: { total: number } & Record<ExportFormat, number>;
  };
}

const SIMPLE_EVENTS: Exclude<AnalyticsEventType, "resume_exported">[] = [
  "login",
  "resume_created",
  "application_created",
  "ai_tailored",
];

export async function getReport(
  period: Period,
  range: number,
  now = new Date()
): Promise<AnalyticsReport> {
  const buckets = recentBucketKeys(period, range, now);

  // Collect every storage key we need for the per-period series...
  const keys = new Set<string>();
  for (const b of buckets) {
    for (const ev of SIMPLE_EVENTS) keys.add(storageKey(ev, period, b));
    for (const fmt of EXPORT_FORMATS)
      keys.add(storageKey("resume_exported", period, b, fmt));
  }
  // ...plus the all-time totals.
  for (const ev of SIMPLE_EVENTS) keys.add(storageKey(ev, "all", "all"));
  for (const fmt of EXPORT_FORMATS)
    keys.add(storageKey("resume_exported", "all", "all", fmt));

  const counts = await getStore().read([...keys]);
  const at = (k: string) => counts[k] ?? 0;

  const simpleSeries = (ev: AnalyticsEventType): number[] =>
    buckets.map((b) => at(storageKey(ev, period, b)));

  const exportSeries: ExportSeries = {
    total: buckets.map(() => 0),
  } as ExportSeries;
  for (const fmt of EXPORT_FORMATS) {
    exportSeries[fmt] = buckets.map((b) =>
      at(storageKey("resume_exported", period, b, fmt))
    );
  }
  exportSeries.total = buckets.map((_, i) =>
    EXPORT_FORMATS.reduce((sum, fmt) => sum + exportSeries[fmt][i], 0)
  );

  const exportTotals = { total: 0 } as { total: number } & Record<
    ExportFormat,
    number
  >;
  for (const fmt of EXPORT_FORMATS) {
    exportTotals[fmt] = at(storageKey("resume_exported", "all", "all", fmt));
  }
  exportTotals.total = EXPORT_FORMATS.reduce(
    (sum, fmt) => sum + exportTotals[fmt],
    0
  );

  return {
    period,
    buckets,
    series: {
      login: simpleSeries("login"),
      resume_created: simpleSeries("resume_created"),
      application_created: simpleSeries("application_created"),
      ai_tailored: simpleSeries("ai_tailored"),
      resume_exported: exportSeries,
    },
    totals: {
      login: at(storageKey("login", "all", "all")),
      resume_created: at(storageKey("resume_created", "all", "all")),
      application_created: at(storageKey("application_created", "all", "all")),
      ai_tailored: at(storageKey("ai_tailored", "all", "all")),
      resume_exported: exportTotals,
    },
  };
}

// Re-exported for callers/tests that want the canonical event list.
export { ANALYTICS_EVENT_TYPES };
