"use client";

// In-app App Store / Play Store rating prompt (Capacitor shell only).
//
// Like lib/nativeAuth.ts, this talks to the plugin through the injected
// `window.Capacitor` bridge instead of importing the package, so the web build
// has no dependency on the native plugin. On the web — or inside an app build
// that predates the InAppReview plugin — every call is a silent no-op.
//
// Call maybeRequestAppReview() after a "success moment" (resume exported,
// interview answer generated). The OS makes the final call on whether a
// prompt actually appears (Apple caps it at ~3/year per user), but we also
// self-throttle below so those chances aren't burned on back-to-back exports.

/* eslint-disable @typescript-eslint/no-explicit-any */

type Capacitorish = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, any>;
};

const STORAGE_KEY = "rf.appReview";

// Ask only once at least this many success moments have accumulated (the
// first download alone shouldn't trigger it), and never more often than the
// cooldown — the OS may or may not show anything each time we ask.
const MIN_MOMENTS = 2;
const COOLDOWN_DAYS = 60;

type ReviewState = { moments: number; lastPromptAt: number };

function readState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        moments: Number(parsed?.moments) || 0,
        lastPromptAt: Number(parsed?.lastPromptAt) || 0,
      };
    }
  } catch {
    // fall through to a fresh state
  }
  return { moments: 0, lastPromptAt: 0 };
}

function writeState(state: ReviewState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — worst case we just don't throttle across sessions
  }
}

// Records a success moment and, when the throttle allows, asks the OS to show
// its native rating sheet. Fire-and-forget: never throws, never blocks the
// calling flow.
export function maybeRequestAppReview(): void {
  try {
    const cap = (globalThis as any).Capacitor as Capacitorish | undefined;
    if (cap?.isNativePlatform?.() !== true) return;
    const plugin = cap?.Plugins?.InAppReview;
    if (typeof plugin?.requestReview !== "function") return;

    const state = readState();
    state.moments += 1;

    const daysSincePrompt =
      (Date.now() - state.lastPromptAt) / (24 * 60 * 60 * 1000);
    if (state.moments >= MIN_MOMENTS && daysSincePrompt >= COOLDOWN_DAYS) {
      state.moments = 0;
      state.lastPromptAt = Date.now();
      // Small delay so the sheet doesn't collide with download/print UI.
      setTimeout(() => {
        void Promise.resolve(plugin.requestReview()).catch(() => {});
      }, 1500);
    }

    writeState(state);
  } catch {
    // Rating is best-effort; never let it break the feature that triggered it.
  }
}
