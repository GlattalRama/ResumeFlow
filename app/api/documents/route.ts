import { NextResponse } from "next/server";
import { createItem, readAll, readByApplication } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId");
  const docs = applicationId
    ? await readByApplication("documents", applicationId)
    : await readAll("documents");
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await createItem("documents", {
    applicationId: body.applicationId,
    resumeVersionId: body.resumeVersionId || "",
    name: body.name || "",
    type: body.type || "Other",
    link: body.link || "",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(created, { status: 201 });
}
