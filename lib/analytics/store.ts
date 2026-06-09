// Analytics counter store.
//
// Holds a single flat document: Record<storageKey, count>. Two interchangeable
// backends, selected the same way the rest of the app picks Drive vs local JSON:
//
//   • Vercel Blob (production) — one private `analytics.json` document, selected
//     when BLOB_READ_WRITE_TOKEN is present. Keeps the "JSON files, no database"
//     model; Blob is just a durable, instance-shared home for the JSON.
//   • Local JSON file (/data/analytics.json) — dev / single-instance fallback.
//     NOT durable on Vercel (ephemeral, per-instance filesystem).
//
// Neither backend has an atomic increment, so increment() is read-modify-write.
// Under concurrency two simultaneous events can lose one update — acceptable for
// a low-traffic app at MVP (see design.md for ETag/sharding mitigations).

import { promises as fs } from "fs";
import path from "path";

export type CounterDoc = Record<string, number>;

export interface AnalyticsStore {
  increment(keys: string[]): Promise<void>;
  read(keys: string[]): Promise<Record<string, number>>;
  // Full counter document — used by the report to count prefix-keyed families
  // (unique-user tokens, country codes) that can't be read by exact key.
  snapshot(): Promise<CounterDoc>;
}

// ---- local JSON file store ------------------------------------------------

const LOCAL_FILE = path.join(process.cwd(), "data", "analytics.json");

async function readLocal(): Promise<CounterDoc> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? (parsed as CounterDoc) : {};
  } catch {
    return {};
  }
}

async function writeLocal(doc: CounterDoc): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(doc, null, 2), "utf8");
}

const localStore: AnalyticsStore = {
  async increment(keys) {
    const doc = await readLocal();
    for (const k of keys) doc[k] = (doc[k] ?? 0) + 1;
    await writeLocal(doc);
  },
  async read(keys) {
    const doc = await readLocal();
    return Object.fromEntries(keys.map((k) => [k, doc[k] ?? 0]));
  },
  async snapshot() {
    return readLocal();
  },
};

// ---- Vercel Blob store ----------------------------------------------------

const BLOB_PATH = "analytics/counters.json";

async function readBlob(): Promise<CounterDoc> {
  // Private read: get() authenticates with BLOB_READ_WRITE_TOKEN and streams the
  // content directly (no public URL). Returns null when the doc doesn't exist
  // yet (first event hasn't been written) — treat that as empty counters.
  const { get } = await import("@vercel/blob");
  const result = await get(BLOB_PATH, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return {};
  try {
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text || "{}");
    return parsed && typeof parsed === "object" ? (parsed as CounterDoc) : {};
  } catch {
    return {};
  }
}

async function writeBlob(doc: CounterDoc): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(doc), {
    access: "private", // owner-only; readable only with the store token
    contentType: "application/json",
    addRandomSuffix: false, // stable path -> overwrite, not a new file each time
    allowOverwrite: true,
  });
}

const blobStore: AnalyticsStore = {
  async increment(keys) {
    const doc = await readBlob();
    for (const k of keys) doc[k] = (doc[k] ?? 0) + 1;
    await writeBlob(doc);
  },
  async read(keys) {
    const doc = await readBlob();
    return Object.fromEntries(keys.map((k) => [k, doc[k] ?? 0]));
  },
  async snapshot() {
    return readBlob();
  },
};

// ---- selector -------------------------------------------------------------

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// Analytics is always "on": Blob in production when its token exists, otherwise
// the local JSON file. There is no hard "disabled" mode — track() is fail-open
// regardless — but callers may use this to skip work when desired.
export function analyticsEnabled(): boolean {
  return true;
}

export function getStore(): AnalyticsStore {
  return blobConfigured() ? blobStore : localStore;
}

export function storeBackend(): "blob" | "local" {
  return blobConfigured() ? "blob" : "local";
}
