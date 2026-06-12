import { randomUUID } from "crypto";
import type { ResumeSnapshot, ResumeVersion } from "./types";
import { readAll, writeAll } from "./store";

// Automatic version history for resumes.
//
// Snapshots are captured server-side around writes so no client cooperates:
//   • on every PUT save, throttled — at most one snapshot per interval, so the
//     editor's 1.2s-debounced autosave doesn't flood history;
//   • force-captured immediately before a restore, so a restore is always
//     reversible.
// Identical-content captures are skipped, and history is capped per resume
// (oldest pruned).

const SNAPSHOT_MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SNAPSHOTS_PER_RESUME = 20;

// The content identity of a version/snapshot — what restore brings back.
function contentKey(v: {
  versionName: string;
  targetRole: string;
  selectedTemplate: string;
  templateStyle?: unknown;
  sectionState?: unknown;
  resumeData: unknown;
}): string {
  return JSON.stringify([
    v.versionName,
    v.targetRole,
    v.selectedTemplate,
    v.templateStyle ?? null,
    v.sectionState ?? null,
    v.resumeData,
  ]);
}

export async function listSnapshots(resumeId: string): Promise<ResumeSnapshot[]> {
  const all = await readAll("resumeSnapshots");
  return all
    .filter((s) => s.resumeId === resumeId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// Capture `resume`'s current state. Returns true when a snapshot was written.
export async function captureSnapshot(
  resume: ResumeVersion,
  reason: ResumeSnapshot["reason"],
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  const all = await readAll("resumeSnapshots");
  const mine = all
    .filter((s) => s.resumeId === resume.id)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const latest = mine[0];

  if (latest && contentKey(latest) === contentKey(resume)) return false;
  if (
    !force &&
    latest &&
    Date.now() - Date.parse(latest.savedAt) < SNAPSHOT_MIN_INTERVAL_MS
  ) {
    return false;
  }

  const snapshot: ResumeSnapshot = {
    id: randomUUID(),
    resumeId: resume.id,
    savedAt: new Date().toISOString(),
    reason,
    versionName: resume.versionName,
    targetRole: resume.targetRole,
    selectedTemplate: resume.selectedTemplate,
    templateStyle: resume.templateStyle,
    formCardState: resume.formCardState,
    sectionState: resume.sectionState,
    resumeData: resume.resumeData,
  };

  const keep = [snapshot, ...mine].slice(0, MAX_SNAPSHOTS_PER_RESUME);
  const others = all.filter((s) => s.resumeId !== resume.id);
  await writeAll("resumeSnapshots", [...others, ...keep]);
  return true;
}

// Remove all snapshots of a deleted resume.
export async function purgeSnapshots(resumeId: string): Promise<void> {
  const all = await readAll("resumeSnapshots");
  const remaining = all.filter((s) => s.resumeId !== resumeId);
  if (remaining.length !== all.length) {
    await writeAll("resumeSnapshots", remaining);
  }
}
