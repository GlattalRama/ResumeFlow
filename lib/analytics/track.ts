// Fail-open analytics emission.
//
// track() NEVER throws and NEVER blocks a user action on failure. If the store
// errors (or anything else goes wrong) the error is swallowed and logged. Call
// sites should `await` it where convenient so the write completes before a
// serverless function suspends, but a rejection here can never break a login,
// save, or export.

import { bucketKeysForEvent } from "./buckets";
import { analyticsEnabled, getStore } from "./store";
import type { AnalyticsEvent } from "./types";

export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    if (!analyticsEnabled()) return;
    await getStore().increment(bucketKeysForEvent(event, new Date()));
  } catch (err) {
    console.warn("[analytics] track failed (ignored):", err);
  }
}
