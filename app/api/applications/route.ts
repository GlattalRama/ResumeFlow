import { NextResponse } from "next/server";
import { createItem, readAll } from "@/lib/store";
import { APPLICATION_STATUSES } from "@/lib/constants";
import type { ApplicationStatus } from "@/lib/types";
import { track } from "@/lib/analytics/track";

export async function GET() {
  const apps = await readAll("applications");
  return NextResponse.json(apps);
}

export async function POST(req: Request) {
  const body = await req.json();
  const now = new Date().toISOString();

  const status: ApplicationStatus = APPLICATION_STATUSES.includes(body.status)
    ? body.status
    : "Saved";

  const created = await createItem("applications", {
    company: body.company || "",
    jobTitle: body.jobTitle || "",
    jobId: body.jobId || "",
    jobLink: body.jobLink || "",
    jobDescription: body.jobDescription || "",
    resumeVersionUsed: body.resumeVersionUsed || "",
    status,
    appliedDate: body.appliedDate || "",
    nextAction: body.nextAction || "",
    nextActionDate: body.nextActionDate || "",
    createdAt: now,
    updatedAt: now,
  });

  // Record the initial status as the first history entry.
  await createItem("statusHistory", {
    applicationId: created.id,
    oldStatus: "",
    newStatus: status,
    changedAt: now,
    comment: "Application created",
  });

  await track({ type: "application_created" });

  return NextResponse.json(created, { status: 201 });
}
