import { NextResponse } from "next/server";
import { createItem, readAll } from "@/lib/store";
import {
  emptyResumeData,
  isTemplateId,
  resolveFormCardState,
  resolveSectionState,
  resolveTemplateStyle,
} from "@/lib/constants";
import type { ResumeData, TemplateId } from "@/lib/types";

export async function GET() {
  const resumes = await readAll("resumes");
  return NextResponse.json(resumes);
}

export async function POST(req: Request) {
  const body = await req.json();
  const now = new Date().toISOString();

  const existing = await readAll("resumes");
  const versionNumber =
    existing.reduce((max, r) => Math.max(max, r.versionNumber), 0) + 1;

  const template: TemplateId = isTemplateId(body.selectedTemplate ?? "")
    ? body.selectedTemplate
    : "modern";

  const resumeData: ResumeData = body.resumeData ?? emptyResumeData();

  const created = await createItem("resumes", {
    versionName: body.versionName || `Version ${versionNumber}`,
    versionNumber,
    targetRole: body.targetRole || "",
    selectedTemplate: template,
    // Normalize to a complete style object (fills any missing fields).
    templateStyle: resolveTemplateStyle(body.templateStyle),
    // Normalize the form card layout against the canonical card list.
    formCardState: resolveFormCardState(body.formCardState),
    // Normalize the document section layout against the canonical section list.
    sectionState: resolveSectionState(body.sectionState),
    resumeData,
    // AI-tailoring provenance (only set when creating a tailored version).
    ...(body.origin === "tailored" ? { origin: "tailored" as const } : {}),
    ...(typeof body.sourceResumeId === "string" && body.sourceResumeId
      ? { sourceResumeId: body.sourceResumeId }
      : {}),
    ...(body.tailoredMetadata ? { tailoredMetadata: body.tailoredMetadata } : {}),
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(created, { status: 201 });
}
