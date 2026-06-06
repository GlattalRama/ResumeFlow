import { NextResponse } from "next/server";
import { createItem, readAll, readByApplication } from "@/lib/store";
import { QNA_DIFFICULTIES } from "@/lib/constants";
import type { QnaDifficulty } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId");
  const items = applicationId
    ? await readByApplication("qna", applicationId)
    : await readAll("qna");
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const difficulty: QnaDifficulty = QNA_DIFFICULTIES.includes(body.difficulty)
    ? body.difficulty
    : "medium";
  const created = await createItem("qna", {
    applicationId: body.applicationId,
    question: body.question || "",
    answer: body.answer || "",
    category: body.category || "General",
    difficulty,
    practiced: Boolean(body.practiced),
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(created, { status: 201 });
}
