// Unified storage facade.
//
// Exposes the same API as lib/jsonStore.ts but routes each call to the right
// backend:
//   • Google Drive appDataFolder  — when real OAuth credentials are configured.
//   • Local /data JSON files       — development fallback when credentials are
//                                    missing (see lib/jsonStore.ts).
//
// Every server component and API route imports from here, so the storage
// backend is chosen in exactly one place.
import { randomUUID } from "crypto";
import type { Collections, CollectionName } from "./types";
import { hasGoogleCredentials, driveFileName } from "./googleConfig";
import {
  driveClient,
  readJsonFile,
  writeJsonFile,
} from "./googleDriveStore";
import { getAccessToken } from "./serverSession";
import * as local from "./jsonStore";

class DriveAuthError extends Error {
  constructor() {
    super(
      "Not signed in to Google. Google Drive storage requires an authenticated session."
    );
    this.name = "DriveAuthError";
  }
}

function useDrive(): boolean {
  return hasGoogleCredentials();
}

async function drive() {
  const token = await getAccessToken();
  if (!token) throw new DriveAuthError();
  return driveClient(token);
}

export async function readAll<N extends CollectionName>(
  name: N
): Promise<Collections[N][]> {
  if (!useDrive()) return local.readAll(name);
  const d = await drive();
  return readJsonFile<Collections[N]>(d, driveFileName(name));
}

export async function writeAll<N extends CollectionName>(
  name: N,
  items: Collections[N][]
): Promise<void> {
  if (!useDrive()) return local.writeAll(name, items);
  const d = await drive();
  await writeJsonFile<Collections[N]>(d, driveFileName(name), items);
}

// The remaining operations are backend-agnostic: they read the whole
// collection, mutate it in memory, and write it back.

export async function getItem<N extends CollectionName>(
  name: N,
  id: string
): Promise<Collections[N] | undefined> {
  const items = await readAll(name);
  return items.find((it) => (it as { id: string }).id === id);
}

export async function createItem<N extends CollectionName>(
  name: N,
  data: Omit<Collections[N], "id"> & { id?: string }
): Promise<Collections[N]> {
  const items = await readAll(name);
  const item = { ...data, id: data.id ?? randomUUID() } as Collections[N];
  items.push(item);
  await writeAll(name, items);
  return item;
}

export async function updateItem<N extends CollectionName>(
  name: N,
  id: string,
  patch: Partial<Collections[N]>
): Promise<Collections[N] | undefined> {
  const items = await readAll(name);
  const idx = items.findIndex((it) => (it as { id: string }).id === id);
  if (idx === -1) return undefined;
  const updated = { ...items[idx], ...patch, id } as Collections[N];
  items[idx] = updated;
  await writeAll(name, items);
  return updated;
}

export async function deleteItem<N extends CollectionName>(
  name: N,
  id: string
): Promise<boolean> {
  const items = await readAll(name);
  const next = items.filter((it) => (it as { id: string }).id !== id);
  if (next.length === items.length) return false;
  await writeAll(name, next);
  return true;
}

export function newId(): string {
  return randomUUID();
}

export async function readByApplication<
  N extends "notes" | "qna" | "statusHistory" | "documents"
>(name: N, applicationId: string): Promise<Collections[N][]> {
  const items = await readAll(name);
  return items.filter(
    (it) => (it as { applicationId: string }).applicationId === applicationId
  );
}
