import { NextResponse } from "next/server";
import {
  createItem,
  deleteItem,
  getItem,
  readAll,
  updateItem,
} from "@/lib/store";
import {
  isTemplateId,
  resolveFormCardState,
  resolveSectionState,
  resolveTemplateStyle,
} from "@/lib/constants";
import { resolveBaseResumeId } from "@/lib/baseResume";
import { captureSnapshot, purgeSnapshots } from "@/lib/resumeHistory";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const resume = await getItem("resumes", id);
  if (!resume)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(resume);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();

  // Version history: snapshot the pre-save state (throttled + deduplicated in
  // captureSnapshot). Best-effort — a history failure must never block a save.
  try {
    const current = await getItem("resumes", id);
    if (current) await captureSnapshot(current, "save");
  } catch (err) {
    console.error("resume snapshot capture failed:", err);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.versionName !== undefined) patch.versionName = body.versionName;
  if (body.targetRole !== undefined) patch.targetRole = body.targetRole;
  if (body.resumeData !== undefined) patch.resumeData = body.resumeData;
  if (body.templateStyle !== undefined)
    patch.templateStyle = resolveTemplateStyle(body.templateStyle);
  if (body.formCardState !== undefined)
    patch.formCardState = resolveFormCardState(body.formCardState);
  if (body.sectionState !== undefined)
    patch.sectionState = resolveSectionState(body.sectionState);
  if (body.selectedTemplate !== undefined && isTemplateId(body.selectedTemplate))
    patch.selectedTemplate = body.selectedTemplate;

  const updated = await updateItem("resumes", id, patch);
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// POST to /api/resumes/[id] duplicates the resume version.
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const source = await getItem("resumes", id);
  if (!source)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const existing = await readAll("resumes");
  const versionNumber =
    existing.reduce((max, r) => Math.max(max, r.versionNumber), 0) + 1;

  const copy = await createItem("resumes", {
    versionName: `${source.versionName} (copy)`,
    versionNumber,
    targetRole: source.targetRole,
    selectedTemplate: source.selectedTemplate,
    templateStyle: resolveTemplateStyle(source.templateStyle),
    formCardState: resolveFormCardState(source.formCardState),
    sectionState: resolveSectionState(source.sectionState),
    resumeData: source.resumeData,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(copy, { status: 201 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  // Deletion requires a designated Base Resume to protect, and the Base Resume
  // itself can never be deleted. This guarantees the user always keeps a clean
  // master copy. resolveBaseResumeId() returns null when none is set or the
  // pointer is dangling, so this also forces the user to (re)designate a base.
  const baseResumeId = await resolveBaseResumeId();
  if (!baseResumeId)
    return NextResponse.json(
      {
        error:
          "Select a Base Resume first. You must designate a Base Resume before you can delete any resume version.",
      },
      { status: 409 }
    );
  if (id === baseResumeId)
    return NextResponse.json(
      {
        error:
          "The Base Resume can't be deleted. Designate a different version as the Base Resume first.",
      },
      { status: 409 }
    );

  const ok = await deleteItem("resumes", id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Best-effort: a deleted resume's history has nothing to restore onto.
  try {
    await purgeSnapshots(id);
  } catch (err) {
    console.error("resume snapshot purge failed:", err);
  }
  return NextResponse.json({ ok: true });
}
