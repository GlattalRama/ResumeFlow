// AI resume-import engine.
//
// Takes the PLAIN TEXT extracted from an uploaded PDF / Word resume and asks the
// model to categorize it into our ResumeData shape: identity (basics), areas of
// expertise, experience (with per-role highlights), education, technical skills
// (category → value), projects, certifications, and languages.
//
// Unlike tailoring, this is pure extraction — the model must NOT invent content,
// only sort what the resume already contains into the right section. Anything it
// can't find is returned as an empty string / empty array. The caller supplies
// the model handle (see lib/aiServer.openrouterModel) and owns daily-cap
// accounting (one import = one unit).
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import type { ResumeData } from "./types";

// The subset of ResumeData the model fills. Everything here maps 1:1 onto
// ResumeData fields; the route merges it over emptyResumeData() + normalizes.
export type ExtractedResume = Pick<
  ResumeData,
  | "basics"
  | "areasOfExpertise"
  | "experience"
  | "education"
  | "skillCategories"
  | "projects"
  | "certifications"
  | "languages"
>;

const extractionSchema = jsonSchema<ExtractedResume>({
  type: "object",
  properties: {
    basics: {
      type: "object",
      properties: {
        name: { type: "string" },
        title: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        location: { type: "string" },
        website: { type: "string" },
        summary: { type: "string" },
      },
      required: [
        "name",
        "title",
        "email",
        "phone",
        "location",
        "website",
        "summary",
      ],
      additionalProperties: false,
    },
    areasOfExpertise: { type: "array", items: { type: "string" } },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
        },
        required: [
          "company",
          "role",
          "location",
          "startDate",
          "endDate",
          "highlights",
        ],
        additionalProperties: false,
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          school: { type: "string" },
          degree: { type: "string" },
          field: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
        required: ["school", "degree", "field", "startDate", "endDate"],
        additionalProperties: false,
      },
    },
    skillCategories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          value: { type: "string" },
        },
        required: ["category", "value"],
        additionalProperties: false,
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          link: { type: "string" },
        },
        required: ["name", "description", "link"],
        additionalProperties: false,
      },
    },
    certifications: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string" } },
  },
  required: [
    "basics",
    "areasOfExpertise",
    "experience",
    "education",
    "skillCategories",
    "projects",
    "certifications",
    "languages",
  ],
  additionalProperties: false,
});

// Build the parser system prompt. When `formatted` is true the input carries
// inline <strong>/<em>/<u> tags (from a .docx) that we want preserved in the
// rich-text fields; otherwise the input is plain text (e.g. a PDF). When
// `multiDoc` is true the input is SEVERAL resume documents (separated by
// "===== DOCUMENT … =====" markers) that belong to the same person and must be
// merged into one resume.
function buildSystemPrompt(formatted: boolean, multiDoc = false): string {
  return [
    multiDoc
      ? "You are a resume parser. You are given the text of SEVERAL resume documents that belong to the SAME person, each introduced by a '===== DOCUMENT: … =====' marker. Merge them into ONE resume and sort the content into the structured sections of the schema."
      : "You are a resume parser. You are given the text extracted from a candidate's resume (PDF or Word). Sort that text into the structured sections of the schema.",
    "",
    "Strict rules:",
    "- EXTRACT ONLY. Never invent, embellish, or add facts, skills, dates, or figures that are not present in the text. If something is missing, return an empty string or empty array — do not guess.",
    ...(multiDoc
      ? [
          "- MERGE, don't concatenate. The documents overlap. When the SAME job (same company + role), school, project, or certification appears in more than one document, output it ONCE: keep the most complete/specific dates, location, and title, and take the UNION of its highlights — drop bullets that are duplicates or near-duplicates of each other.",
          "- For single-value fields (basics.name, title, email, phone, location, website, summary): pick the single best value across the documents — prefer the most complete, most recent, non-empty one. Never merge two different summaries into a run-on paragraph.",
          "- For list fields (areasOfExpertise, skillCategories, projects, certifications, languages): take the union across documents and remove duplicates.",
          "- Order experience and education most-recent-first across the merged set.",
        ]
      : []),
    "- basics.name, title (their headline/current role), email, phone, location, website: pull from the header/contact block.",
    "- basics.summary: the professional summary / objective / profile paragraph. Empty if there isn't one.",
    "- experience: one entry per job, most recent first. Put each bullet/accomplishment as a separate string in highlights (strip leading bullet glyphs). startDate/endDate are free text exactly as written (e.g. 'Jan 2020', 'Present').",
    "- education: one entry per school. degree (e.g. 'B.S.') and field (e.g. 'Computer Science') separately when possible.",
    "- skillCategories: technical/professional skills as category → value rows. If skills are grouped (e.g. 'Languages: Python, Go'), use category='Languages', value='Python, Go'. If they are an ungrouped list, use category='' and put the comma-joined list in value.",
    "- areasOfExpertise: short competency keywords/phrases if the resume has a distinct 'Areas of Expertise' / 'Core Competencies' block; otherwise leave empty.",
    "- projects, certifications, languages: fill only if the resume clearly has them.",
    formatted
      ? "FORMATTING: the input contains inline tags <strong> (bold), <em> (italic), and <u> (underline) showing how words were emphasized. In basics.summary and in each experience highlight, KEEP these tags around exactly the same words as in the input. Never add a tag to text that wasn't tagged, and use no tag other than <strong>, <em>, <u>. In EVERY OTHER field output plain text with NO tags."
      : "Return plain text in every field (no HTML, no markdown).",
  ].join("\n");
}

// Parse extracted resume text into our structured ResumeData subset. Throws on
// model/transport errors (the route maps those to a 502 and credit alerts).
// `formatted` indicates the input carries inline <strong>/<em>/<u> tags that
// should be preserved in the rich-text fields (summary, experience highlights).
// `multiDoc` indicates the text is several resume documents to merge into one.
export async function extractResumeFromText(
  text: string,
  model: LanguageModel,
  formatted = false,
  multiDoc = false
): Promise<ExtractedResume> {
  const { object } = await generateObject({
    model,
    schema: extractionSchema,
    system: buildSystemPrompt(formatted, multiDoc),
    // Cap the input so a pathological upload can't blow the context / cost.
    // Allow more room when merging several documents.
    prompt: `Resume text:\n\n${text.slice(0, multiDoc ? 48000 : 24000)}`,
    maxOutputTokens: multiDoc ? 6000 : 4000,
  });
  // The model is asked to confine formatting to the rich-text fields, but never
  // trust it: keep only the allowed inline tags there and strip tags everywhere
  // else, so a stray <table>/<script> can't leak into the resume.
  return sanitizeImportFormatting(object, formatted);
}

// ── formatting helpers ──────────────────────────────────────────────────────

// Decode the handful of HTML entities mammoth / the model may emit.
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

// Convert mammoth's .docx HTML into compact text that keeps ONLY inline
// <strong>/<em>/<u> tags and turns block boundaries into newlines. <b>/<i> are
// normalized to the app's <strong>/<em>; every other tag is dropped (its inner
// text is preserved). This is what we feed the parser model so it can carry the
// formatting into basics.summary and experience highlights.
export function htmlToInlineFormattedText(html: string): string {
  let s = html.replace(/<\s*(script|style)\b[\s\S]*?<\/\s*\1\s*>/gi, "");
  // Normalize bold/italic aliases to the stored tag names.
  s = s
    .replace(/<\s*b(\s[^>]*)?>/gi, "<strong>")
    .replace(/<\s*\/\s*b\s*>/gi, "</strong>")
    .replace(/<\s*i(\s[^>]*)?>/gi, "<em>")
    .replace(/<\s*\/\s*i\s*>/gi, "</em>");
  // Strip attributes off the tags we keep.
  s = s
    .replace(/<\s*(strong|em|u)(\s[^>]*)?>/gi, "<$1>")
    .replace(/<\s*\/\s*(strong|em|u)\s*>/gi, "</$1>");
  // Block boundaries → newlines (so sections/bullets stay separated).
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(
    /<\s*\/\s*(p|div|li|h[1-6]|tr|table|ul|ol|section)\s*>/gi,
    "\n"
  );
  // Drop every remaining tag (keep inner text), preserving only strong/em/u.
  s = s.replace(/<\/?(?!(?:strong|em|u)\b)[a-zA-Z][^>]*>/gi, "");
  s = decodeEntities(s);
  // Tidy whitespace without collapsing intentional line breaks.
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Remove ALL tags from a string (plain-text fields).
function stripAllTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/[ \t]+/g, " ").trim();
}

// Keep only the allowed inline formatting tags; drop everything else.
function keepInlineTags(s: string): string {
  return s
    .replace(/<\s*b(\s[^>]*)?>/gi, "<strong>")
    .replace(/<\s*\/\s*b\s*>/gi, "</strong>")
    .replace(/<\s*i(\s[^>]*)?>/gi, "<em>")
    .replace(/<\s*\/\s*i\s*>/gi, "</em>")
    .replace(/<\/?(?!(?:strong|em|u|s)\b)[a-zA-Z][^>]*>/gi, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Confine formatting to the rich-text fields (summary + experience highlights)
// and force plain text everywhere else.
function sanitizeImportFormatting(
  d: ExtractedResume,
  formatted: boolean
): ExtractedResume {
  const rich = (s: string) => (formatted ? keepInlineTags(s) : stripAllTags(s));
  return {
    basics: {
      name: stripAllTags(d.basics.name),
      title: stripAllTags(d.basics.title),
      email: stripAllTags(d.basics.email),
      phone: stripAllTags(d.basics.phone),
      location: stripAllTags(d.basics.location),
      website: stripAllTags(d.basics.website),
      summary: rich(d.basics.summary),
    },
    areasOfExpertise: d.areasOfExpertise.map(stripAllTags),
    experience: d.experience.map((e) => ({
      company: stripAllTags(e.company),
      role: stripAllTags(e.role),
      location: stripAllTags(e.location),
      startDate: stripAllTags(e.startDate),
      endDate: stripAllTags(e.endDate),
      highlights: e.highlights.map(rich),
    })),
    education: d.education.map((ed) => ({
      school: stripAllTags(ed.school),
      degree: stripAllTags(ed.degree),
      field: stripAllTags(ed.field),
      startDate: stripAllTags(ed.startDate),
      endDate: stripAllTags(ed.endDate),
    })),
    skillCategories: d.skillCategories.map((c) => ({
      category: stripAllTags(c.category),
      value: stripAllTags(c.value),
    })),
    projects: d.projects.map((p) => ({
      name: stripAllTags(p.name),
      description: stripAllTags(p.description),
      link: stripAllTags(p.link),
    })),
    certifications: d.certifications.map(stripAllTags),
    languages: d.languages.map(stripAllTags),
  };
}
