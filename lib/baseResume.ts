// Base Resume helpers.
//
// The Base Resume is the user's clean master resume (like git `main`). It is
// identified by a single `baseResumeId` pointer on the settings singleton, not
// by a per-version flag — so "exactly one base" falls out of the data shape and
// designating a base is one atomic settings write (see lib/aiSettings).
//
// These helpers resolve that pointer against the resumes collection, treating a
// pointer that no longer matches any version as "no base set" (self-healing when
// the designated version is deleted).
import { readAll } from "./store";
import { loadSettings, setBaseResumeId } from "./aiSettings";
import type { ResumeVersion } from "./types";

// Pure check: is this version the configured base? `baseResumeId` is whatever the
// caller already resolved (or read), so list UIs can pass it once for many rows.
export function isBaseResume(
  versionId: string,
  baseResumeId: string | null | undefined
): boolean {
  return !!baseResumeId && versionId === baseResumeId;
}

// Resolve the configured Base Resume id, or null if none is set or the pointer
// is dangling (points at a deleted version).
export async function resolveBaseResumeId(): Promise<string | null> {
  const s = await loadSettings();
  const id = s?.baseResumeId;
  if (!id) return null;
  const resumes = await readAll("resumes");
  return resumes.some((r) => r.id === id) ? id : null;
}

// Resolve and return the Base Resume version itself, or null if none/dangling.
export async function getBaseResume(): Promise<ResumeVersion | null> {
  const s = await loadSettings();
  const id = s?.baseResumeId;
  if (!id) return null;
  const resumes = await readAll("resumes");
  return resumes.find((r) => r.id === id) ?? null;
}

// Designate a version as the Base Resume. Returns false if the id does not match
// any existing resume version (so the API can answer 404 rather than storing a
// dangling pointer).
export async function setBaseResume(resumeId: string): Promise<boolean> {
  const resumes = await readAll("resumes");
  if (!resumes.some((r) => r.id === resumeId)) return false;
  await setBaseResumeId(resumeId);
  return true;
}

// Clear the Base Resume designation.
export async function clearBaseResume(): Promise<void> {
  await setBaseResumeId(null);
}
