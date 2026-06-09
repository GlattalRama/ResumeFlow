// Builds the prompt context + per-action system prompts for the application
// "AI assistant" actions. The context is a compact, plain-text summary of the
// job application and the linked resume version, kept small enough to stay well
// inside the model's budget while giving the model the real facts to work from.
import type { Application, ResumeVersion } from "./types";

// Strip the lightweight HTML that rich-text fields (e.g. experience highlights)
// may contain, leaving readable plain text for the prompt.
function stripHtml(input: string): string {
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function skillsLine(resume: ResumeVersion): string {
  const cats = resume.resumeData.skillCategories
    ?.filter((c) => c.value.trim())
    .map((c) => (c.category ? `${c.category}: ${c.value}` : c.value));
  if (cats && cats.length) return cats.join("; ");
  return (resume.resumeData.skills || []).filter(Boolean).join(", ");
}

// Compact, plain-text snapshot of the job + candidate the actions reason over.
export function buildContext(
  app: Application,
  resume?: ResumeVersion
): string {
  const lines: string[] = [];

  lines.push("=== JOB APPLICATION ===");
  lines.push(`Company: ${app.company || "(unknown)"}`);
  lines.push(`Job title: ${app.jobTitle || "(unknown)"}`);
  if (app.status) lines.push(`Application status: ${app.status}`);
  if (app.jobDescription?.trim()) {
    lines.push("Job description:");
    lines.push(stripHtml(app.jobDescription).slice(0, 4000));
  } else {
    lines.push("Job description: (none provided)");
  }

  lines.push("");
  lines.push("=== CANDIDATE RESUME ===");
  if (!resume) {
    lines.push("(no resume version linked to this application)");
    return lines.join("\n");
  }

  const b = resume.resumeData.basics;
  if (b.name) lines.push(`Name: ${b.name}`);
  if (b.title) lines.push(`Headline: ${b.title}`);
  if (resume.targetRole) lines.push(`Target role: ${resume.targetRole}`);
  if (b.location) lines.push(`Location: ${b.location}`);
  if (b.summary?.trim()) {
    lines.push("Summary:");
    lines.push(stripHtml(b.summary));
  }

  const skills = skillsLine(resume);
  if (skills) {
    lines.push("");
    lines.push(`Skills: ${skills}`);
  }

  const experience = resume.resumeData.experience || [];
  if (experience.length) {
    lines.push("");
    lines.push("Experience:");
    for (const exp of experience.slice(0, 5)) {
      const period = [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
      const header = [exp.role, exp.company].filter(Boolean).join(" at ");
      lines.push(`- ${header}${period ? ` (${period})` : ""}`);
      for (const h of (exp.highlights || []).slice(0, 6)) {
        const clean = stripHtml(h);
        if (clean) lines.push(`  • ${clean}`);
      }
    }
  }

  const education = resume.resumeData.education || [];
  if (education.length) {
    lines.push("");
    lines.push("Education:");
    for (const ed of education.slice(0, 3)) {
      const degree = [ed.degree, ed.field].filter(Boolean).join(", ");
      lines.push(`- ${[degree, ed.school].filter(Boolean).join(" — ")}`);
    }
  }

  const projects = resume.resumeData.projects || [];
  if (projects.length) {
    lines.push("");
    lines.push("Projects:");
    for (const p of projects.slice(0, 3)) {
      lines.push(`- ${p.name}${p.description ? `: ${stripHtml(p.description)}` : ""}`);
    }
  }

  const certs = (resume.resumeData.certifications || []).filter(Boolean);
  if (certs.length) {
    lines.push("");
    lines.push(`Certifications: ${certs.join(", ")}`);
  }

  return lines.join("\n");
}

// Per-action system prompts. Each is told to use ONLY the supplied facts (no
// invented metrics or experience) and to return clean, ready-to-use output.
export const ACTION_SYSTEM_PROMPTS: Record<string, string> = {
  "tailor-resume":
    "You are a professional resume writer and ATS expert. Given the candidate's resume and the target job below, give specific, actionable suggestions to tailor the resume to THIS job. Cover: keywords from the job description to mirror, which experience and skills to emphasize or reorder, gaps to address, and concrete quantification opportunities. Reference the candidate's actual content — do not invent experience or metrics. Use short bullet points grouped under brief headings. Return plain text only (no markdown code fences).",
  "interview-briefing":
    "You are an interview prep coach. Produce a focused pre-interview briefing for the candidate and job below. Include: what to research about the company/role, the candidate's strongest talking points mapped to the job's requirements, likely interview focus areas, three STAR stories the candidate can prepare (drawn from their real experience), and three smart questions to ask the interviewer. Do not invent facts about the candidate. Return plain text with short headings and bullets (no markdown code fences).",
  "cover-letter":
    "You are a professional cover letter writer. Write a tailored, professional cover letter (three to four short paragraphs) for the candidate applying to the job below. Open with genuine interest, connect two or three of the candidate's REAL achievements to the job's needs, and close with a call to action. Use the candidate's actual name and details; do not invent facts or metrics that aren't present. Return only the letter text (no markdown code fences).",
  "follow-up":
    "You are a career coach. Write a brief, professional post-interview follow-up / thank-you message for the candidate and job below. Reference the role and company, express continued interest, and keep it under 150 words. Include a short subject line. Return only the message text (no markdown code fences).",
};

// System prompt for the structured interview Q&A generator.
export const QNA_SYSTEM_PROMPT =
  "You are an expert interview coach. Generate 6 realistic interview questions tailored to the candidate and the specific job below, each with concise model-answer guidance (2-4 sentences) the candidate can personalize. Do not invent specific facts about the candidate — guidance should describe HOW to answer using their own experience. Cover a mix of behavioral, technical/role-specific, and closing questions. For each item set a short category (e.g. Behavioral, Technical, Role-specific, Closing) and a difficulty of easy, medium, or hard.";
