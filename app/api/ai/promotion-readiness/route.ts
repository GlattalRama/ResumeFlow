import { NextResponse } from "next/server";
import { readAll } from "@/lib/store";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { setPromotionReadiness } from "@/lib/aiSettings";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { generatePromotionReadiness } from "@/lib/aiCareer";
import type { PromotionReadiness } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Assess promotion readiness across the 7 dimensions from the whole Work
// Journal and cache it on the settings singleton. Regenerated on demand only.
export async function POST() {
  const notes = await readAll("workJournal");
  if (notes.length < 3) {
    return NextResponse.json(
      { error: "Add a few more journal entries first — a readiness assessment needs some history." },
      { status: 400 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const result = await generatePromotionReadiness(
      notes,
      openrouterModel(access.apiKey, access.model)
    );
    const readiness: PromotionReadiness = {
      ...result,
      generatedAt: new Date().toISOString(),
      noteCount: notes.length,
    };
    await setPromotionReadiness(readiness);
    return NextResponse.json({ readiness });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(err instanceof Error ? err.message : String(err));
    }
    console.error("ai/promotion-readiness error:", err);
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
