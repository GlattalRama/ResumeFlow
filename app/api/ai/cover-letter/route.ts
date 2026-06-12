import { NextResponse } from "next/server";
import { getItem } from "@/lib/store";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import {
  generateCoverLetter,
  COVER_LETTER_TONES,
  type CoverLetterTone,
} from "@/lib/aiCoverLetter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Generate a cover letter DRAFT from a source resume + an application's job
// description. Persists nothing — the client saves the (possibly edited)
// letter onto the application record after review.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sourceResumeId =
    typeof body.sourceResumeId === "string" ? body.sourceResumeId.trim() : "";
  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  const tone: CoverLetterTone = COVER_LETTER_TONES.some((t) => t.id === body.tone)
    ? body.tone
    : "professional";

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
    return NextResponse.json({ error: "Source resume not found" }, { status: 404 });
  }
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const { letter, unverifiedFigures } = await generateCoverLetter(
      source.resumeData,
      {
        company: app.company,
        jobTitle: app.jobTitle,
        jobDescription: app.jobDescription,
      },
      tone,
      openrouterModel(access.apiKey, access.model)
    );

    return NextResponse.json({
      letter,
      unverifiedFigures,
      meta: {
        sourceResumeId,
        tone,
        model: access.model,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(
        err instanceof Error ? err.message : String(err)
      );
    }
    console.error("ai/cover-letter error:", err);
    const message =
      err instanceof Error ? err.message : "Cover letter generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
