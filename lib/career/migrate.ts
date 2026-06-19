// Phase 1 (Career Growth System): bridge between legacy free-text journal notes
// and the STAR-native model. Star is the source of truth going forward; the
// legacy prose fields (whatIDid/problemSolved/impactResult) are kept as a
// derived mirror so existing AI digests, bullet generation, and add-to-resume
// keep working without change.
import type { Star, WorkJournalNote } from "@/lib/types";

export const STAR_SCHEMA_VERSION = 2;

const blankStar: Star = { situation: "", task: "", action: "", result: "" };

// Build STAR from the legacy prose fields. problemSolved carried both the
// situation and the task, so it seeds Situation; the user can split it later.
export function starFromLegacy(n: {
  whatIDid: string;
  problemSolved: string;
  impactResult: string;
}): Star {
  return {
    situation: n.problemSolved || "",
    task: "",
    action: n.whatIDid || "",
    result: n.impactResult || "",
  };
}

// Keep the legacy prose mirror in sync with STAR so downstream AI features that
// read whatIDid/problemSolved/impactResult still have substance to work with.
export function legacyFromStar(star: Star): {
  whatIDid: string;
  problemSolved: string;
  impactResult: string;
} {
  const problem = [star.situation, star.task].filter(Boolean).join(" ");
  return {
    whatIDid: star.action || "",
    problemSolved: problem,
    impactResult: star.result || "",
  };
}

function hasStarContent(s: Star | undefined): s is Star {
  return !!s && Boolean(s.situation || s.task || s.action || s.result);
}

// Lazy, non-destructive migration applied on read. Backfills `star` from the
// legacy fields for v1 notes and stamps the schema version. Never drops data.
export function toV2(note: WorkJournalNote): WorkJournalNote {
  if (note.schemaVersion === STAR_SCHEMA_VERSION && note.star) return note;
  const star = hasStarContent(note.star) ? note.star : starFromLegacy(note);
  return {
    ...note,
    star: { ...blankStar, ...star },
    category: note.category ?? "",
    schemaVersion: STAR_SCHEMA_VERSION,
  };
}
