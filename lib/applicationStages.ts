// Pure helpers for the applications tracker: pipeline stages (tabs), relative
// dates, and overdue checks. No DOM, safe for server components.
import type { Application, ApplicationStatus } from "./types";

// Tracker tabs. Each stage groups one or more statuses; "all" shows everything.
export const STAGES = [
  "all",
  "saved",
  "applied",
  "interviewing",
  "offer",
  "archived",
] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_STATUSES: Record<Exclude<Stage, "all">, ApplicationStatus[]> = {
  saved: ["Saved"],
  applied: ["Applied"],
  interviewing: ["Phone Screen", "Interview"],
  offer: ["Offer"],
  archived: ["Rejected", "Withdrawn"],
};

export function stageOf(status: ApplicationStatus): Exclude<Stage, "all"> {
  for (const [stage, statuses] of Object.entries(STAGE_STATUSES)) {
    if (statuses.includes(status)) return stage as Exclude<Stage, "all">;
  }
  return "saved";
}

export function isStage(v: string | undefined): v is Stage {
  return (STAGES as readonly string[]).includes(v ?? "");
}

export const SORTS = ["updated", "applied", "company", "nextAction"] as const;
export type SortKey = (typeof SORTS)[number];

export function isSortKey(v: string | undefined): v is SortKey {
  return (SORTS as readonly string[]).includes(v ?? "");
}

// Sort a stage's applications. Missing dates sort last within the chosen key.
export function sortApplications(apps: Application[], sort: SortKey): Application[] {
  const byMissingLast = (a: string, b: string) =>
    a && b ? b.localeCompare(a) : a ? -1 : b ? 1 : 0;
  return [...apps].sort((a, b) => {
    switch (sort) {
      case "applied":
        return byMissingLast(a.appliedDate, b.appliedDate) || b.updatedAt.localeCompare(a.updatedAt);
      case "company":
        return (
          (a.company || "").localeCompare(b.company || "", undefined, { sensitivity: "base" }) ||
          b.updatedAt.localeCompare(a.updatedAt)
        );
      case "nextAction": {
        // Soonest next action first; applications without one go last.
        const ad = a.nextActionDate || "";
        const bd = b.nextActionDate || "";
        if (ad && bd) return ad.localeCompare(bd);
        if (ad) return -1;
        if (bd) return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      case "updated":
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
}

// Parse "YYYY-MM-DD" (as a local date) or an ISO timestamp.
export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "3 days ago", "yesterday", "in 2 days" — localized, coarse (days/weeks/months).
export function relativeTime(
  value: string | undefined | null,
  locale: string,
  now: Date = new Date()
): string {
  const d = parseDate(value);
  if (!d) return "";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const dayMs = 86_400_000;
  const days = Math.round((d.getTime() - now.getTime()) / dayMs);
  if (Math.abs(days) < 1) {
    const hours = Math.round((d.getTime() - now.getTime()) / 3_600_000);
    return Math.abs(hours) < 1 ? rtf.format(0, "day") : rtf.format(hours, "hour");
  }
  if (Math.abs(days) < 14) return rtf.format(days, "day");
  if (Math.abs(days) < 60) return rtf.format(Math.round(days / 7), "week");
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

// A next-action date that is today or already past.
export function isDue(value: string | undefined | null, now: Date = new Date()): boolean {
  const d = parseDate(value);
  if (!d) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() <= today.getTime();
}

// Deterministic avatar colour for a company monogram.
export function monogram(name: string): { initials: string; hue: number } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return { initials, hue: h };
}
