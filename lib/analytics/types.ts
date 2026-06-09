// Analytics event model.
//
// PRIVACY: this is the ONLY shape that ever reaches the analytics store. It has
// no field for resume text, job descriptions, photos, names, emails, raw user
// ids, IPs, or user agents — the privacy guarantee is enforced by this type, not
// by convention. The single non-event dimension we allow is a closed enum
// (`format` on exports). Adding an event or dimension is a code change here, not
// user input.

export const EXPORT_FORMATS = ["pdf", "docx", "pptx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type AnalyticsEvent =
  | { type: "login" }
  | { type: "resume_created" }
  | { type: "application_created" }
  | { type: "resume_exported"; format: ExportFormat }
  | { type: "ai_tailored" };

export type AnalyticsEventType = AnalyticsEvent["type"];

export const ANALYTICS_EVENT_TYPES: AnalyticsEventType[] = [
  "login",
  "resume_created",
  "application_created",
  "resume_exported",
  "ai_tailored",
];

// Time-bucket periods. `all` is a single all-time bucket.
export const PERIODS = ["day", "week", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export function isPeriod(value: string): value is Period {
  return (PERIODS as readonly string[]).includes(value);
}

export function isExportFormat(value: unknown): value is ExportFormat {
  return (
    typeof value === "string" &&
    (EXPORT_FORMATS as readonly string[]).includes(value)
  );
}
