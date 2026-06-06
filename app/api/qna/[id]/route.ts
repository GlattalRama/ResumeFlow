import { NextResponse } from "next/server";
import { deleteItem, updateItem } from "@/lib/store";
import type { QnaItem } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const patch: Partial<QnaItem> = {};
  if (body.answer !== undefined) patch.answer = body.answer;
  if (body.question !== undefined) patch.question = body.question;
  if (body.practiced !== undefined) patch.practiced = Boolean(body.practiced);
  const updated = await updateItem("qna", id, patch);
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteItem("qna", id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
