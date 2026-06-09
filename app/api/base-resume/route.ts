import { NextResponse } from "next/server";
import {
  resolveBaseResumeId,
  setBaseResume,
  clearBaseResume,
} from "@/lib/baseResume";

export const dynamic = "force-dynamic";

// Return the currently designated Base Resume id (null if none / dangling).
export async function GET() {
  return NextResponse.json({ baseResumeId: await resolveBaseResumeId() });
}

// Designate a resume version as the Base Resume.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resumeId =
    typeof body.resumeId === "string" ? body.resumeId.trim() : "";
  if (!resumeId) {
    return NextResponse.json(
      { error: "resumeId is required" },
      { status: 400 }
    );
  }
  const ok = await setBaseResume(resumeId);
  if (!ok) {
    return NextResponse.json(
      { error: "Resume version not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, baseResumeId: resumeId });
}

// Clear the Base Resume designation.
export async function DELETE() {
  await clearBaseResume();
  return NextResponse.json({ ok: true });
}
