import { NextResponse } from "next/server";
import { generateText, generateObject, jsonSchema } from "ai";
import { createItem, getItem } from "@/lib/store";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";
import {
  buildContext,
  ACTION_SYSTEM_PROMPTS,
  QNA_SYSTEM_PROMPT,
} from "@/lib/aiContext";
import {
  coverLetter,
  followUpMessage,
  interviewBriefing,
  sampleQna,
  tailorResumeSuggestions,
  type SampleQna,
} from "@/lib/aiPlaceholders";
import type { Application, ResumeVersion } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEXT_ACTIONS = new Set([
  "tailor-resume",
  "interview-briefing",
  "cover-letter",
  "follow-up",
]);
const KNOWN_ACTIONS = new Set(["generate-qna", ...TEXT_ACTIONS]);

const qnaSchema = jsonSchema<{
  items: {
    question: string;
    answer: string;
    category: string;
    difficulty: "easy" | "medium" | "hard";
  }[];
}>({
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          category: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["question", "answer", "category", "difficulty"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
});

// Persist generated Q&A items against an application. Returns the count.
async function persistQna(
  applicationId: string,
  items: SampleQna[]
): Promise<number> {
  for (const s of items) {
    await createItem("qna", {
      applicationId,
      question: s.question,
      answer: s.answer,
      category: s.category,
      difficulty: s.difficulty,
      practiced: false,
      createdAt: new Date().toISOString(),
    });
  }
  return items.length;
}

// Deterministic, offline fallback — used when no API key is configured or the
// provider call fails, so the AI assistant still produces something useful.
async function runPlaceholder(
  action: string,
  app: Application,
  resume: ResumeVersion | undefined,
  applicationId: string
) {
  if (action === "generate-qna") {
    const created = await persistQna(applicationId, sampleQna(app, resume));
    return NextResponse.json({
      created,
      message: `Generated ${created} sample Q&A items (offline draft).`,
      source: "placeholder",
    });
  }
  const text =
    action === "tailor-resume"
      ? tailorResumeSuggestions(app)
      : action === "interview-briefing"
        ? interviewBriefing(app, resume)
        : action === "cover-letter"
          ? coverLetter(app, resume)
          : followUpMessage(app);
  return NextResponse.json({ text, source: "placeholder" });
}

export async function POST(req: Request) {
  const { action, applicationId } = await req.json();

  if (!KNOWN_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const app = await getItem("applications", applicationId);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const resume = app.resumeVersionUsed
    ? await getItem("resumes", app.resumeVersionUsed)
    : undefined;

  const access = await resolveAiAccess();

  // The daily cap is a deliberate limit, not a failure — surface it to the user
  // instead of silently degrading to the offline draft.
  if (!access.ok && access.status === 429) {
    return NextResponse.json({ error: access.message }, { status: 429 });
  }

  // Try real AI whenever we have a usable key; otherwise fall back to the
  // offline placeholders (e.g. no key configured at all).
  if (access.ok) {
    try {
      const context = buildContext(app, resume);
      const model = openrouterModel(access.apiKey, access.model);

      if (action === "generate-qna") {
        const { object } = await generateObject({
          model,
          schema: qnaSchema,
          system: QNA_SYSTEM_PROMPT,
          prompt: context,
          maxOutputTokens: 1200,
        });
        const created = await persistQna(applicationId, object.items);
        return NextResponse.json({
          created,
          message: `Generated ${created} tailored Q&A items.`,
          source: "ai",
        });
      }

      const { text } = await generateText({
        model,
        system: ACTION_SYSTEM_PROMPTS[action],
        prompt: context,
        maxOutputTokens: 900,
      });
      return NextResponse.json({ text: text.trim(), source: "ai" });
    } catch (err) {
      if (!access.usingUserKey && isCreditsError(err)) {
        void notifyOwnerCreditsExhausted(
          err instanceof Error ? err.message : String(err)
        );
      }
      console.error("ai action error:", err);
      // Fall through to the offline placeholder so the user still gets output.
    }
  }

  return runPlaceholder(action, app, resume, applicationId);
}
