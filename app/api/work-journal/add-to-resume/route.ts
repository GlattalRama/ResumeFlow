import { NextResponse } from "next/server";
import { getItem, updateItem } from "@/lib/store";
import { captureSnapshot } from "@/lib/resumeHistory";

export const dynamic = "force-dynamic";

// Append one approved Work Journal bullet to a specific experience entry of a
// resume version, then record the linkage on the journal note. The bullet text
// is whatever the user approved client-side (possibly edited after generation).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const noteId = typeof body.noteId === "string" ? body.noteId : "";
  const resumeId = typeof body.resumeId === "string" ? body.resumeId : "";
  const bullet = typeof body.bullet === "string" ? body.bullet.trim() : "";
  const experienceIndex = Number.isInteger(body.experienceIndex)
    ? (body.experienceIndex as number)
    : -1;

  if (!noteId || !resumeId || !bullet || experienceIndex < 0) {
    return NextResponse.json(
      { error: "noteId, resumeId, experienceIndex and bullet are required" },
      { status: 400 }
    );
  }

  const [note, resume] = await Promise.all([
    getItem("workJournal", noteId),
    getItem("resumes", resumeId),
  ]);
  if (!note) {
    return NextResponse.json({ error: "Journal note not found" }, { status: 404 });
  }
  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }
  const exp = resume.resumeData.experience[experienceIndex];
  if (!exp) {
    return NextResponse.json(
      { error: "Experience entry not found on that resume" },
      { status: 404 }
    );
  }
  if (exp.highlights.some((h) => h.trim() === bullet)) {
    return NextResponse.json(
      { error: "That bullet is already on the selected experience entry" },
      { status: 409 }
    );
  }

  // Version history: snapshot before mutating, same as a manual save.
  try {
    await captureSnapshot(resume, "save");
  } catch (err) {
    console.error("work-journal add-to-resume snapshot failed:", err);
  }

  const experience = resume.resumeData.experience.map((e, i) =>
    i === experienceIndex ? { ...e, highlights: [...e.highlights, bullet] } : e
  );
  const updatedResume = await updateItem("resumes", resumeId, {
    resumeData: { ...resume.resumeData, experience },
    updatedAt: new Date().toISOString(),
  });

  const updatedNote = await updateItem("workJournal", noteId, {
    linkedResumeId: resumeId,
    linkedSection: `experience:${experienceIndex}`,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, resume: updatedResume, note: updatedNote });
}
