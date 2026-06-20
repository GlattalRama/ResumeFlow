import { NextResponse } from "next/server";
import { getItem } from "@/lib/store";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import {
  generateBulletsFromNote,
  generateStarFromNote,
  improveNoteWording,
} from "@/lib/aiWorkJournal";
import { generateOutputs } from "@/lib/aiCareer";
import type { GeneratedOutputs } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Action = "bullets" | "improve" | "star" | "outputs";
const ACTIONS: Action[] = ["bullets", "improve", "star", "outputs"];

// Run one AI action over a Work Journal note. Persists nothing — the client
// shows the result for review and saves only what the user accepts.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const noteId = typeof body.noteId === "string" ? body.noteId : "";
  const action = ACTIONS.includes(body.action) ? (body.action as Action) : null;

  if (!noteId || !action) {
    return NextResponse.json(
      { error: "noteId and a valid action are required" },
      { status: 400 }
    );
  }

  // Validate before resolving access so a bad request never burns a daily-cap unit.
  const note = await getItem("workJournal", noteId);
  if (!note) {
    return NextResponse.json({ error: "Journal note not found" }, { status: 404 });
  }
  const hasSubstance = [
    note.whatIDid,
    note.problemSolved,
    note.impactResult,
    note.toolsTechnologies,
  ].some((f) => f.trim().length > 0);
  if (!hasSubstance) {
    return NextResponse.json(
      {
        error:
          "This note is too empty to work with — fill in at least one of: what you did, problem solved, or impact.",
      },
      { status: 400 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    const model = openrouterModel(access.apiKey, access.model);
    if (action === "bullets") {
      const bullets = await generateBulletsFromNote(note, model);
      return NextResponse.json({ bullets });
    }
    if (action === "improve") {
      const fields = await improveNoteWording(note, model);
      return NextResponse.json({ fields });
    }
    if (action === "outputs") {
      const result = await generateOutputs(note, model);
      // Returned (not persisted) — the client saves it via PATCH, matching the
      // app's "review before save" convention. generatedAt/model let the UI
      // flag stale outputs after later edits.
      const outputs: GeneratedOutputs = {
        ...result,
        generatedAt: new Date().toISOString(),
        model: access.model,
      };
      return NextResponse.json({ outputs });
    }
    const star = await generateStarFromNote(note, model);
    return NextResponse.json({ star });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(
        err instanceof Error ? err.message : String(err)
      );
    }
    console.error("ai/work-journal error:", err);
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
