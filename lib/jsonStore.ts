import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Collections, CollectionName } from "./types";

// JSON-file backed storage. One file per collection in /data.
// Files auto-create with an empty array if missing.

const DATA_DIR = path.join(process.cwd(), "data");

function fileFor(name: CollectionName): string {
  return path.join(DATA_DIR, `${name}.json`);
}

async function ensureFile(name: CollectionName): Promise<string> {
  const file = fileFor(name);
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf8");
  }
  return file;
}

export async function readAll<N extends CollectionName>(
  name: N
): Promise<Collections[N][]> {
  const file = await ensureFile(name);
  const raw = await fs.readFile(file, "utf8");
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as Collections[N][]) : [];
  } catch {
    return [];
  }
}

export async function writeAll<N extends CollectionName>(
  name: N,
  items: Collections[N][]
): Promise<void> {
  const file = await ensureFile(name);
  await fs.writeFile(file, JSON.stringify(items, null, 2), "utf8");
}

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

// Query helper: all items in a collection matching applicationId.
export async function readByApplication<
  N extends "notes" | "qna" | "statusHistory" | "documents"
>(name: N, applicationId: string): Promise<Collections[N][]> {
  const items = await readAll(name);
  return items.filter(
    (it) => (it as { applicationId: string }).applicationId === applicationId
  );
}
