import { NextResponse } from "next/server";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import {
  buildCertificationScanText,
  extractCertificationsFromText,
} from "@/lib/aiImport";
import { emptyResumeData, normalizeResumeData } from "@/lib/constants";
import type { ResumeData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Re-read the resume the user is editing and return the certifications its
// content mentions (summary, experience, education, projects, skills, custom
// sections — everything except the certifications list itself). PERSISTS
// NOTHING — the builder merges the result into its certifications field and
// saves through the normal /api/resumes path. One refresh = one cap unit.
export async function POST(req: Request) {
  let data: ResumeData;
  try {
    const body = await req.json();
    if (!body?.resumeData || typeof body.resumeData !== "object") {
      throw new Error("missing resumeData");
    }
    data = normalizeResumeData({ ...emptyResumeData(), ...body.resumeData });
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body with a resumeData object." },
      { status: 400 }
    );
  }

  // Build the scan corpus BEFORE resolving access, so an effectively empty
  // resume never burns a daily-cap unit.
  const text = buildCertificationScanText(data);
  if (text.trim().length < 30) {
    return NextResponse.json(
      {
        error:
          "This resume doesn't have enough content to scan yet. Fill in the summary, experience, or other sections first.",
      },
      { status: 422 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const certifications = await extractCertificationsFromText(
      text,
      openrouterModel(access.apiKey, access.model)
    );
    return NextResponse.json({ certifications });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(
        err instanceof Error ? err.message : String(err)
      );
    }
    console.error("resumes/certifications/refresh error:", err);
    const message =
      err instanceof Error ? err.message : "Certification scan failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
