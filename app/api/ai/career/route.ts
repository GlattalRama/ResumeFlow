import { NextResponse } from "next/server";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import { expandToStar, polishStar, type ExpandContext } from "@/lib/aiCareer";
import type { Star } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function readStar(v: unknown): Star {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    situation: str(o.situation),
    task: str(o.task),
    action: str(o.action),
    result: str(o.result),
  };
}

// "Help Me Write" (expand) and "Polish wording" (polish). Persists nothing —
// the client shows the draft for review and saves only what the user accepts.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action === "expand" || body.action === "polish" ? body.action : null;
  if (!action) {
    return NextResponse.json({ error: "A valid action is required" }, { status: 400 });
  }

  // Validate before resolving access so a bad request never burns a cap unit.
  let text = "";
  let star: Star | null = null;
  if (action === "expand") {
    text = str(body.text).trim();
    if (text.length < 8) {
      return NextResponse.json(
        { error: "Write a sentence or two about what you did first." },
        { status: 400 }
      );
    }
  } else {
    star = readStar(body.star);
    if (!Object.values(star).some((f) => f.trim().length > 0)) {
      return NextResponse.json(
        { error: "There's nothing to polish yet — fill in some STAR fields first." },
        { status: 400 }
      );
    }
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const model = openrouterModel(access.apiKey, access.model);
    if (action === "expand") {
      const context: ExpandContext = {
        role: str(body.role),
        company: str(body.company),
        client: str(body.client),
        project: str(body.project),
      };
      const result = await expandToStar(text, context, model);
      return NextResponse.json(result);
    }
    const polished = await polishStar(star!, model);
    return NextResponse.json({ star: polished });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(err instanceof Error ? err.message : String(err));
    }
    console.error("ai/career error:", err);
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
