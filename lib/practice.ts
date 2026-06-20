// Shared helpers for interview practice sessions.
import type { PracticeAttempt } from "./types";

// Average of graded attempts' overall score (0 when none graded yet).
export function computeOverall(attempts: PracticeAttempt[]): number {
  const graded = attempts.filter((a) => a.feedback);
  if (graded.length === 0) return 0;
  const sum = graded.reduce((s, a) => s + (a.feedback?.overall ?? 0), 0);
  return Math.round((sum / graded.length) * 10) / 10;
}
