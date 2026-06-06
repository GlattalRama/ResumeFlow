// Low-level Google Drive appDataFolder helpers.
// All functions take an access token and operate inside the user's hidden
// app-data storage area. JSON collections are stored one file each; profile
// photos are stored as individual image files.
import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";

const APP_DATA_FOLDER = "appDataFolder";

export function driveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
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
export async function readJsonFile<T>(
  drive: drive_v3.Drive,
  name: string
): Promise<T[]> {
  const id = await findFile(drive, name);
  if (!id) {
    await createJsonFile(drive, name, [] as T[]);
    return [];
  }
  const res = await drive.files.get(
    { fileId: id, alt: "media" },
    { responseType: "json" }
  );
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
  data: T[]
): Promise<void> {
  const id = await findFile(drive, name);
  if (!id) {
    await createJsonFile(drive, name, data);
    return;
  }
  await drive.files.update({
    fileId: id,
    media: { mimeType: "application/json", body: JSON.stringify(data) },
  });
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

export async function deleteFile(
  drive: drive_v3.Drive,
  fileId: string
): Promise<void> {
  await drive.files.delete({ fileId });
}
