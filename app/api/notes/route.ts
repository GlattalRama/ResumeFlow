import { NextResponse } from "next/server";
import { createItem, readAll, readByApplication } from "@/lib/store";
import { NOTE_TYPES } from "@/lib/constants";
import type { NoteType } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId");
  const notes = applicationId
    ? await readByApplication("notes", applicationId)
    : await readAll("notes");
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const body = await req.json();
  const type: NoteType = NOTE_TYPES.includes(body.type) ? body.type : "general";
  const created = await createItem("notes", {
    applicationId: body.applicationId,
    type,
    text: body.text || "",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(created, { status: 201 });
}
