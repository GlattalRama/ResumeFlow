// Truth-preserving cover letter generation.
//
// The letter draws ONLY on facts present in the source resume (and may
// reference the job description). Like tailoring (lib/aiTailor), the prompt is
// not the guardrail: after generation, every numeric figure in the letter is
// checked against the resume + JD, and unverifiable figures are surfaced as
// warnings for the user to fix while editing — a letter (unlike a tailored
// section) has no verbatim source to fall back to.
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import type { ResumeBasics, ResumeData } from "./types";
import { numberTokens, type TailorJob } from "./aiTailor";
import { htmlToLines } from "./richText";

export const COVER_LETTER_TONES = [
  {
    id: "professional",
    label: "Professional",
    instruction:
      "Tone: polished and professional — confident, concrete, no fluff.",
  },
  {
    id: "warm",
    label: "Warm",
    instruction:
      "Tone: warm and personable — professional but human, showing genuine enthusiasm for the company's mission.",
  },
  {
    id: "direct",
    label: "Direct",
    instruction:
      "Tone: direct and impact-first — lead with results, short sentences, no pleasantries beyond the minimum.",
  },
] as const;

export type CoverLetterTone = (typeof COVER_LETTER_TONES)[number]["id"];

export interface CoverLetterResult {
  letter: string;
  // Figures in the letter that could not be verified against the resume or
  // the job description — shown to the user to double-check while editing.
  unverifiedFigures: string[];
}

const letterSchema = jsonSchema<{ letter: string }>({
  type: "object",
  properties: {
    letter: {
      type: "string",
      description:
        "The complete cover letter as plain text. Paragraphs separated by blank lines. No markdown, no subject line, no address block.",
    },
  },
  required: ["letter"],
  additionalProperties: false,
});

// Compact resume digest given to the model — enough to write from, small
// enough to keep the prompt lean.
function resumeDigest(d: ResumeData): string {
  const lines: string[] = [
    `Name: ${d.basics.name || "(unknown)"}`,
    `Current title: ${d.basics.title || "(unknown)"}`,
    `Summary: ${htmlToLines(d.basics.summary).join(" ")}`,
  ];
  for (const exp of (d.experience || []).slice(0, 5)) {
    lines.push(
      `Role: ${exp.role} at ${exp.company} (${[exp.startDate, exp.endDate]
        .filter(Boolean)
        .join(" – ")})`
    );
    for (const h of (exp.highlights || []).slice(0, 6)) lines.push(`  - ${h}`);
  }
  const skills = [
    ...(d.areasOfExpertise || []),
    ...(d.skillCategories || []).map((s) => s.value),
  ]
    .filter(Boolean)
    .join(", ");
  if (skills) lines.push(`Skills: ${skills}`);
  const certs = (d.certifications || []).join(", ");
  if (certs) lines.push(`Certifications: ${certs}`);
  return lines.join("\n");
}

// Despite the prompt's hard rules, models occasionally emit a template-style
// header block of bracket placeholders ("[Your Name]", "[City, State, Zip]",
// "[Date]"). Deterministic cleanup, same philosophy as the figure check below:
// fill placeholders whose real value the resume knows, drop lines that are
// nothing but unresolved placeholders, keep everything else untouched.
export function fillLetterPlaceholders(
  letter: string,
  basics: ResumeBasics,
  today: string
): string {
  const location = basics.showLocation === false ? "" : basics.location?.trim() ?? "";
  const substitutions: Array<[RegExp, string]> = [
    [/\[\s*(your\s+)?(full\s+)?name\s*\]/gi, basics.name?.trim() ?? ""],
    [/\[\s*(your\s+)?e-?mail(\s+address)?\s*\]/gi, basics.email?.trim() ?? ""],
    [/\[\s*(your\s+)?(tele)?phone(\s+number)?\s*\]/gi, basics.phone?.trim() ?? ""],
    [/\[\s*(today'?s\s+)?date\s*\]/gi, today],
    [/\[\s*(your\s+)?(street\s+|home\s+|mailing\s+)?address\s*\]/gi, ""],
    [/\[\s*city[^\]\n]*\]/gi, location],
    [/\[\s*(hiring\s+manager|recipient)[^\]\n]*\]/gi, "Hiring Manager"],
  ];

  const lines = letter.split("\n").map((rawLine) => {
    let line = rawLine;
    for (const [pattern, value] of substitutions) line = line.replace(pattern, value);
    // Anything still bracketed is a placeholder we can't fill.
    const withoutPlaceholders = line.replace(/\[[^\]\n]*\]/g, "");
    // A line that carried only placeholders (plus punctuation) is dropped
    // entirely; a line with real content keeps it, minus the leftovers.
    return /[a-z0-9]/i.test(withoutPlaceholders)
      ? withoutPlaceholders.trimEnd()
      : "";
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function generateCoverLetter(
  source: ResumeData,
  job: TailorJob,
  tone: CoverLetterTone,
  model: LanguageModel
): Promise<CoverLetterResult> {
  const toneInstruction =
    COVER_LETTER_TONES.find((t) => t.id === tone)?.instruction ??
    COVER_LETTER_TONES[0].instruction;

  const { object } = await generateObject({
    model,
    schema: letterSchema,
    system: [
      "You are an expert cover letter writer.",
      "Write a complete, ready-to-send cover letter for the candidate and job below.",
      "Structure: greeting (\"Dear Hiring Manager,\" unless a name is in the job description); an opening that names the role and company with a specific hook; 1–2 body paragraphs mapping the candidate's strongest RELEVANT achievements to the job's top requirements; a brief close with a call to action; sign-off with the candidate's name.",
      "Hard rules: 250–350 words. Use ONLY facts, achievements, and figures present in the candidate's resume digest — never invent employers, metrics, tools, or qualifications. Do not restate the resume bullet-by-bullet; synthesize. No clichés like 'I am writing to express my interest'. Never emit bracket placeholders such as \"[Your Name]\" or \"[Date]\", and no sender contact/address header — the letter starts directly with the greeting. Plain text only.",
      toneInstruction,
    ].join("\n"),
    prompt: [
      `Target role: ${job.jobTitle || "(unknown)"} at ${job.company || "(unknown)"}`,
      "",
      "Job description:",
      (job.jobDescription || "(none provided)").slice(0, 4000),
      "",
      "Candidate resume digest:",
      resumeDigest(source),
    ].join("\n"),
    maxOutputTokens: 900,
  });

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const letter = fillLetterPlaceholders(object.letter.trim(), source.basics, today);

  // Verify figures: anything numeric in the letter must appear in the resume
  // or the JD (years like "2018" in dates count via the digest text). Contact
  // details and today's date may have been substituted in above, so they count
  // as known too.
  const known = numberTokens(
    [
      resumeDigest(source),
      job.jobDescription || "",
      source.basics.email,
      source.basics.phone,
      source.basics.location,
      today,
    ].join(" ")
  );
  const unverifiedFigures = [...numberTokens(letter)].filter((n) => !known.has(n));

  return { letter, unverifiedFigures };
}
