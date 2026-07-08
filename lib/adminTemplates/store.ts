// Admin template-visibility store.
//
// Holds one app-global document: Record<TemplateId, boolean> where true = force
// visible, false = force hidden. This is an ADMIN setting shared by every user,
// so — unlike the per-user AI settings singleton, which lives in the caller's
// own Google Drive appData — it must NOT be keyed to a logged-in session.
//
// It mirrors lib/analytics/store.ts: two interchangeable backends selected the
// same way, by presence of BLOB_READ_WRITE_TOKEN.
//
//   • Vercel Blob (production) — one private `admin/template-visibility.json`
//     document, store-token-scoped and therefore shared across all instances
//     and users.
//   • Local JSON file (/data/template-visibility.json) — dev / single-instance
//     fallback. NOT durable on Vercel (ephemeral, per-instance filesystem).
//
// Neither backend has an atomic update, so writes are last-write-wins. This map
// changes only on rare admin toggles, so contention is a non-issue.

import { promises as fs } from "fs";
import path from "path";

export type VisibilityDoc = Record<string, boolean>;

function coerce(parsed: unknown): VisibilityDoc {
  if (!parsed || typeof parsed !== "object") return {};
  const out: VisibilityDoc = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

// ---- local JSON file store ------------------------------------------------

const LOCAL_FILE = path.join(process.cwd(), "data", "template-visibility.json");

async function readLocal(): Promise<VisibilityDoc> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    return coerce(JSON.parse(raw || "{}"));
  } catch {
    return {};
  }
}

async function writeLocal(doc: VisibilityDoc): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(doc, null, 2), "utf8");
}

// ---- Vercel Blob store ----------------------------------------------------

const BLOB_PATH = "admin/template-visibility.json";

async function readBlob(): Promise<VisibilityDoc> {
  // Private read: get() authenticates with BLOB_READ_WRITE_TOKEN and streams the
  // content directly (no public URL). Returns null when the doc doesn't exist
  // yet (no admin has toggled anything) — treat that as no overrides.
  const { get } = await import("@vercel/blob");
  const result = await get(BLOB_PATH, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return {};
  try {
    const text = await new Response(result.stream).text();
    return coerce(JSON.parse(text || "{}"));
  } catch {
    return {};
  }
}

async function writeBlob(doc: VisibilityDoc): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(doc), {
    access: "private", // owner-only; readable only with the store token
    contentType: "application/json",
    addRandomSuffix: false, // stable path -> overwrite, not a new file each time
    allowOverwrite: true,
  });
}

// ---- selector -------------------------------------------------------------

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readTemplateVisibility(): Promise<VisibilityDoc> {
  return blobConfigured() ? readBlob() : readLocal();
}

export async function writeTemplateVisibility(doc: VisibilityDoc): Promise<void> {
  return blobConfigured() ? writeBlob(doc) : writeLocal(doc);
}
