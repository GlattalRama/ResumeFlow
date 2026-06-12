import { NextResponse } from "next/server";
import { createItem, deleteItem, getItem, updateItem } from "@/lib/store";
import { APPLICATION_STATUSES } from "@/lib/constants";
import type { Application, ApplicationStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const app = await getItem("applications", id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(app);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();

  const current = await getItem("applications", id);
  if (!current)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const editable: (keyof Application)[] = [
    "company",
    "jobTitle",
    "jobId",
    "jobLink",
    "jobDescription",
    "resumeVersionUsed",
    "appliedDate",
    "nextAction",
    "nextActionDate",
    "coverLetter",
    "coverLetterMeta",
  ];
  const patch: Partial<Application> = { updatedAt: new Date().toISOString() };
  for (const key of editable) {
    if (body[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = body[key];
    }
  }

  // Status change: validate + record a history entry.
  if (
    body.status !== undefined &&
    APPLICATION_STATUSES.includes(body.status) &&
    body.status !== current.status
  ) {
    const newStatus = body.status as ApplicationStatus;
    patch.status = newStatus;
    await createItem("statusHistory", {
      applicationId: id,
      oldStatus: current.status,
      newStatus,
      changedAt: new Date().toISOString(),
      comment: body.statusComment || "",
    });
  }

  const updated = await updateItem("applications", id, patch);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteItem("applications", id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
