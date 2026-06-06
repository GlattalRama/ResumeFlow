import type { Application, ResumeVersion } from "./types";

// Deterministic, offline "AI" placeholders. No external API is called.
// These produce plausible sample content from the application + resume data.

export interface SampleQna {
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export function sampleQna(
  app: Application,
  resume?: ResumeVersion
): SampleQna[] {
  const role = app.jobTitle || resume?.targetRole || "this role";
  const company = app.company || "the company";
  const topSkill = resume?.resumeData.skills[0] || "your core skill";

  return [
    {
      question: `Tell me about yourself and why you're interested in the ${role} role at ${company}.`,
      answer:
        "Draft: summarize your background in 2–3 sentences, connect your experience to the role, and end with why this company.",
      category: "Behavioral",
      difficulty: "easy",
    },
    {
      question: `Walk me through a project where you used ${topSkill}.`,
      answer:
        "Draft: pick one project, state the problem, your specific contribution, and the measurable outcome (STAR format).",
      category: "Technical",
      difficulty: "medium",
    },
    {
      question: `Describe a time you handled a difficult deadline or conflict.`,
      answer:
        "Draft: use STAR — Situation, Task, Action, Result. Keep it under two minutes.",
      category: "Behavioral",
      difficulty: "medium",
    },
    {
      question: `What questions do you have for us about ${company}?`,
      answer:
        "Draft: prepare 2–3 questions about team structure, success metrics, and growth.",
      category: "Closing",
      difficulty: "easy",
    },
  ];
}

export function tailorResumeSuggestions(app: Application): string {
  const role = app.jobTitle || "the target role";
  return [
    `Tailoring suggestions for "${role}" at ${app.company || "the company"}:`,
    "",
    "• Mirror keywords from the job description in your summary and skills.",
    "• Move the most relevant experience bullet to the top of each role.",
    "• Quantify outcomes (%, $, time saved) wherever possible.",
    "• Trim unrelated experience to keep the resume to one page.",
    app.jobDescription
      ? "• Detected job description — scan it for required tools and add matching skills."
      : "• Add the job description to this application for sharper suggestions.",
  ].join("\n");
}

export function interviewBriefing(
  app: Application,
  resume?: ResumeVersion
): string {
  return [
    `Interview briefing — ${app.jobTitle || "Role"} @ ${app.company || "Company"}`,
    "",
    `Resume version: ${resume?.versionName || "none linked"}`,
    `Status: ${app.status}`,
    "",
    "Prep checklist:",
    "• Research recent company news and product launches.",
    "• Re-read the job description and map each requirement to a story.",
    "• Prepare 3 STAR stories covering leadership, conflict, and impact.",
    "• Have 3 thoughtful questions ready for the interviewer.",
  ].join("\n");
}

export function coverLetter(app: Application, resume?: ResumeVersion): string {
  const name = resume?.resumeData.basics.name || "[Your Name]";
  return [
    `Dear ${app.company || "Hiring Team"},`,
    "",
    `I'm excited to apply for the ${app.jobTitle || "open"} position. ` +
      "My background aligns closely with what your team is looking for, and " +
      "I'm confident I can contribute from day one.",
    "",
    "[Draft body — highlight 2–3 relevant achievements here.]",
    "",
    "Thank you for your consideration.",
    "",
    `Sincerely,`,
    name,
  ].join("\n");
}

export function followUpMessage(app: Application): string {
  return [
    `Subject: Following up — ${app.jobTitle || "application"}`,
    "",
    `Hi,`,
    "",
    `Thank you for taking the time to discuss the ${app.jobTitle || "role"} at ` +
      `${app.company || "your company"}. I enjoyed the conversation and remain ` +
      "very interested in the opportunity. Please let me know if there's anything " +
      "else I can provide.",
    "",
    "Best regards,",
  ].join("\n");
}
