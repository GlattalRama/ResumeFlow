// Fail-open analytics emission.
//
// track() NEVER throws and NEVER blocks a user action on failure. If the store
// errors (or anything else goes wrong) the error is swallowed and logged. Call
// sites should `await` it where convenient so the write completes before a
// serverless function suspends, but a rejection here can never break a login,
// save, or export.

import { bucketKeysForEvent, periodKeys } from "./buckets";
import { analyticsEnabled, getStore } from "./store";
import { hashUser, normalizeCountry } from "./users";
import type { AnalyticsEvent } from "./types";

export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    if (!analyticsEnabled()) return;
    await getStore().increment(bucketKeysForEvent(event, new Date()));
  } catch (err) {
    console.warn("[analytics] track failed (ignored):", err);
  }
}

// Login is tracked specially so it can also feed the active-user count and the
// country breakdown — both aggregate and non-identifying:
//   • a salted, non-reversible token of the user id (distinct-user counting)
//   • a 2-letter country code from Vercel's geo header (no IP stored)
// userId / country are optional; whatever is missing is simply not counted.
export async function trackLogin(ctx: {
  userId?: string | null;
  country?: string | null;
}): Promise<void> {
  try {
    if (!analyticsEnabled()) return;
    const now = new Date();
    const keys = [...bucketKeysForEvent({ type: "login" }, now)];
    if (ctx.userId) keys.push(...periodKeys("uu", hashUser(ctx.userId), now));
    const cc = normalizeCountry(ctx.country);
    if (cc) keys.push(...periodKeys("country", cc, now));
    await getStore().increment(keys);
  } catch (err) {
    console.warn("[analytics] trackLogin failed (ignored):", err);
  }
}
