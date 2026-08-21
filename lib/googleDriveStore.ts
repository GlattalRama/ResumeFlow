// Low-level Google Drive appDataFolder helpers.
// All functions take an access token and operate inside the user's hidden
// app-data storage area. JSON collections are stored one file each; profile
// photos are stored as individual image files.
import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";

const APP_DATA_FOLDER = "appDataFolder";

// Drive file ids never change once a file exists, so remember them per user
// and skip the files.list lookup that otherwise precedes every read — it
// halves the Drive API calls per collection. Fluid compute reuses function
// instances, so this survives across requests. A stale id (file deleted from
// another device) surfaces as a 404 and the caller invalidates + retries.
const fileIdCache = new Map<string, string>();
const FILE_ID_CACHE_MAX = 5000;

function cacheId(cacheKey: string | null, name: string): string | null {
  return cacheKey ? `${cacheKey}/${name}` : null;
}

function rememberFileId(cacheKey: string | null, name: string, id: string) {
  const key = cacheId(cacheKey, name);
  if (!key) return;
  if (fileIdCache.size >= FILE_ID_CACHE_MAX) fileIdCache.clear();
  fileIdCache.set(key, id);
}

function isNotFound(err: unknown): boolean {
  return (err as { code?: number; status?: number })?.code === 404 ||
    (err as { code?: number; status?: number })?.status === 404;
}

// Google throttles Drive per user; when a burst trips the limit every call
// fails instantly with 403 userRateLimitExceeded (or 429) for a short window.
// gaxios does not retry by default, so without this a throttled window
// surfaces as a hard error page instead of a briefly slower render.
export function driveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({
    version: "v3",
    auth,
    retryConfig: {
      retry: 3,
      // 403 is only retried when Google marks it a rate-limit (see below);
      // plain permission 403s are rethrown immediately by shouldRetry.
      statusCodesToRetry: [
        [403, 403],
        [429, 429],
        [500, 599],
      ],
      shouldRetry: (err) => {
        const status = err.response?.status ?? (err as { code?: number }).code;
        if (status === 429 || (typeof status === "number" && status >= 500)) {
          return true;
        }
        if (status !== 403) return false;
        const reason = JSON.stringify(err.response?.data ?? "");
        return /ratelimitexceeded|quotaexceeded/i.test(reason);
      },
      retryDelay: 500, // exponential from here: ~0.5s, 1s, 2s
    },
  });
}

// Find a file by exact name inside appDataFolder. Returns its id or null.
export async function findFile(
  drive: drive_v3.Drive,
  name: string
): Promise<string | null> {
  const res = await drive.files.list({
    spaces: APP_DATA_FOLDER,
    q: `name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

// Read a JSON array file from appDataFolder. Creates it with [] if missing.
// `cacheKey` (a stable per-user key) enables the file-id cache above.
export async function readJsonFile<T>(
  drive: drive_v3.Drive,
  name: string,
  cacheKey: string | null = null
): Promise<T[]> {
  const key = cacheId(cacheKey, name);
  let id = (key && fileIdCache.get(key)) || null;
  const cameFromCache = !!id;
  if (!id) {
    id = await findFile(drive, name);
    if (!id) {
      const created = await createJsonFile(drive, name, [] as T[]);
      rememberFileId(cacheKey, name, created);
      return [];
    }
    rememberFileId(cacheKey, name, id);
  }
  let res;
  try {
    res = await drive.files.get(
      { fileId: id, alt: "media" },
      { responseType: "json" }
    );
  } catch (err) {
    if (!cameFromCache || !isNotFound(err)) throw err;
    // Cached id went stale — drop it and retry with a fresh lookup.
    if (key) fileIdCache.delete(key);
    return readJsonFile(drive, name, cacheKey);
  }
  const data = res.data as unknown;
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data || "[]");
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function createJsonFile<T>(
  drive: drive_v3.Drive,
  name: string,
  data: T[]
): Promise<string> {
  const res = await drive.files.create({
    requestBody: { name, parents: [APP_DATA_FOLDER] },
    media: { mimeType: "application/json", body: JSON.stringify(data) },
    fields: "id",
  });
  return res.data.id as string;
}

// Create-or-update a JSON array file in appDataFolder.
export async function writeJsonFile<T>(
  drive: drive_v3.Drive,
  name: string,
  data: T[],
  cacheKey: string | null = null
): Promise<void> {
  const key = cacheId(cacheKey, name);
  let id = (key && fileIdCache.get(key)) || null;
  const cameFromCache = !!id;
  if (!id) {
    id = await findFile(drive, name);
    if (!id) {
      const created = await createJsonFile(drive, name, data);
      rememberFileId(cacheKey, name, created);
      return;
    }
    rememberFileId(cacheKey, name, id);
  }
  try {
    await drive.files.update({
      fileId: id,
      media: { mimeType: "application/json", body: JSON.stringify(data) },
    });
  } catch (err) {
    if (!cameFromCache || !isNotFound(err)) throw err;
    if (key) fileIdCache.delete(key);
    return writeJsonFile(drive, name, data, cacheKey);
  }
}

// Upload an image file to appDataFolder. Returns the new Drive file id.
export async function uploadImage(
  drive: drive_v3.Drive,
  name: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  const res = await drive.files.create({
    requestBody: { name, parents: [APP_DATA_FOLDER], mimeType },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });
  return res.data.id as string;
}

// Fetch an image file's bytes + mime type by Drive file id.
export async function getImage(
  drive: drive_v3.Drive,
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const meta = await drive.files.get({ fileId, fields: "mimeType" });
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    mimeType: meta.data.mimeType ?? "application/octet-stream",
  };
}

// Rename a Drive file (metadata only; the bytes are untouched).
export async function renameFile(
  drive: drive_v3.Drive,
  fileId: string,
  name: string
): Promise<void> {
  await drive.files.update({ fileId, requestBody: { name } });
}

export async function deleteFile(
  drive: drive_v3.Drive,
  fileId: string
): Promise<void> {
  await drive.files.delete({ fileId });
}
