import { NextResponse } from "next/server";
import { deleteItem, getItem, updateItem } from "@/lib/store";
import type { ProjectExperience } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
const strList = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : undefined;

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await getItem("projectExperience", id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Partial<ProjectExperience> = {
    updatedAt: new Date().toISOString(),
  };
  for (const key of [
    "name",
    "client",
    "domain",
    "description",
    "techStack",
    "role",
    "period",
  ] as const) {
    const v = str(body[key]);
    if (v !== undefined) patch[key] = v;
  }
  const responsibilities = strList(body.responsibilities);
  if (responsibilities !== undefined) patch.responsibilities = responsibilities;
  const achievements = strList(body.achievements);
  if (achievements !== undefined) patch.achievements = achievements;

  const updated = await updateItem("projectExperience", id, patch);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteItem("projectExperience", id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
