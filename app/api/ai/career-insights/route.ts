import { NextResponse } from "next/server";
import { readAll } from "@/lib/store";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { setCareerInsights } from "@/lib/aiSettings";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { generateInsights } from "@/lib/aiCareer";
import type { CareerInsights } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Generate collection-level career insights from the whole Work Journal and
// cache them on the settings singleton. Regenerated on demand only — the cache
// keeps this off the daily-cap on every dashboard visit.
export async function POST() {
  const notes = await readAll("workJournal");
  if (notes.length < 3) {
    return NextResponse.json(
      { error: "Add a few more journal entries first — insights need some history to work with." },
      { status: 400 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const result = await generateInsights(notes, openrouterModel(access.apiKey, access.model));
    const insights: CareerInsights = {
      ...result,
      generatedAt: new Date().toISOString(),
      noteCount: notes.length,
    };
    await setCareerInsights(insights);
    return NextResponse.json({ insights });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(err instanceof Error ? err.message : String(err));
    }
    console.error("ai/career-insights error:", err);
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
