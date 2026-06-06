import { NextResponse } from "next/server";
import { createItem, getItem } from "@/lib/store";
import {
  coverLetter,
  followUpMessage,
  interviewBriefing,
  sampleQna,
  tailorResumeSuggestions,
} from "@/lib/aiPlaceholders";

// Placeholder AI endpoint. No external API is called — content is generated
// locally and deterministically from existing application + resume data.
export async function POST(req: Request) {
  const { action, applicationId } = await req.json();

  const app = await getItem("applications", applicationId);
  if (!app) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }
  const resume = app.resumeVersionUsed
    ? await getItem("resumes", app.resumeVersionUsed)
    : undefined;

  switch (action) {
    case "generate-qna": {
      const samples = sampleQna(app, resume);
      const created = [];
      for (const s of samples) {
        created.push(
          await createItem("qna", {
            applicationId,
            question: s.question,
            answer: s.answer,
            category: s.category,
            difficulty: s.difficulty,
            practiced: false,
            createdAt: new Date().toISOString(),
          })
        );
      }
      return NextResponse.json({
        created: created.length,
        message: `Generated ${created.length} sample Q&A items (placeholder).`,
      });
    }
    case "tailor-resume":
      return NextResponse.json({ text: tailorResumeSuggestions(app) });
    case "interview-briefing":
      return NextResponse.json({ text: interviewBriefing(app, resume) });
    case "cover-letter":
      return NextResponse.json({ text: coverLetter(app, resume) });
    case "follow-up":
      return NextResponse.json({ text: followUpMessage(app) });
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
