import { NextResponse } from "next/server";
import { getItem } from "@/lib/store";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { tailorResumeData } from "@/lib/aiTailor";
import type { TailoredResumeMetadata } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Generate a job-tailored resume DRAFT from a source resume + an application's
// job description. Returns the tailored resumeData, the section-level change
// summary, and metadata — but PERSISTS NOTHING. Saving happens only after the
// user accepts (via the resume-version create path).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sourceResumeId =
    typeof body.sourceResumeId === "string" ? body.sourceResumeId.trim() : "";
  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId.trim() : "";

  if (!sourceResumeId || !applicationId) {
    return NextResponse.json(
      { error: "sourceResumeId and applicationId are required" },
      { status: 400 }
    );
  }

  // Validate inputs BEFORE resolving access, so a bad request never burns a
  // daily-cap unit.
  const [source, app] = await Promise.all([
    getItem("resumes", sourceResumeId),
    getItem("applications", applicationId),
  ]);
  if (!source) {
    return NextResponse.json(
      { error: "Source resume not found" },
      { status: 404 }
    );
  }
  if (!app) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }

  // One tailoring run = one cap unit (resolveAiAccess increments once); the
  // per-section model calls below reuse the returned key/model.
  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const { resumeData, sectionChanges, reasons } = await tailorResumeData(
      source.resumeData,
      {
        company: app.company,
        jobTitle: app.jobTitle,
        jobDescription: app.jobDescription,
      },
      openrouterModel(access.apiKey, access.model)
    );

    const metadata: TailoredResumeMetadata = {
      sourceResumeId,
      applicationId,
      company: app.company,
      jobTitle: app.jobTitle,
      jobId: app.jobId,
      // Snapshot the JD as it was at generation time.
      jobDescriptionSnapshot: app.jobDescription,
      model: access.model,
      generatedAt: new Date().toISOString(),
      sectionChanges,
    };

    return NextResponse.json({ resumeData, sectionChanges, reasons, metadata });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(
        err instanceof Error ? err.message : String(err)
      );
    }
    console.error("ai/tailor error:", err);
    const message =
      err instanceof Error ? err.message : "Tailoring request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
