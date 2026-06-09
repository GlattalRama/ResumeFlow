// Privacy helpers for active-user counts and country breakdown.
//
// We never store a user's identity. To count DISTINCT users without keeping a
// user list, we store a salted, truncated, non-reversible hash of the user id —
// a pseudonymous token that can't be reversed back to an email or enumerated.
// Country is a coarse 2-letter ISO code from Vercel's geo header (no IP, no
// city), so it stays aggregate and non-identifying.

import { createHash } from "crypto";

// Stable per-deployment salt so the same user maps to the same token across
// requests, but the token can't be precomputed without the secret. AUTH_SECRET
// is always set in any real deployment; the dev fallback only affects local.
function salt(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "resumeflow-dev-salt";
}

// 16 hex chars (64 bits) — collision-negligible for this scale, and short enough
// that it's a counting token, not a fingerprint.
export function hashUser(userId: string): string {
  return createHash("sha256")
    .update(`${salt()}:${userId.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

// Normalize Vercel's `x-vercel-ip-country` to a clean 2-letter uppercase code,
// or null when absent/unparseable (those logins simply aren't counted by
// country — country totals are "where known").
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cc = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : null;
}
