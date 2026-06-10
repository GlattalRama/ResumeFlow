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

const SYSTEM_PROMPT = [
  "You are a resume parser. You are given the raw text extracted from a candidate's resume (PDF or Word). Sort that text into the structured sections of the schema.",
  "",
  "Strict rules:",
  "- EXTRACT ONLY. Never invent, embellish, or add facts, skills, dates, or figures that are not present in the text. If something is missing, return an empty string or empty array — do not guess.",
  "- basics.name, title (their headline/current role), email, phone, location, website: pull from the header/contact block.",
  "- basics.summary: the professional summary / objective / profile paragraph, as plain text. Empty if there isn't one.",
  "- experience: one entry per job, most recent first. Put each bullet/accomplishment as a separate string in highlights (strip leading bullet glyphs). startDate/endDate are free text exactly as written (e.g. 'Jan 2020', 'Present').",
  "- education: one entry per school. degree (e.g. 'B.S.') and field (e.g. 'Computer Science') separately when possible.",
  "- skillCategories: technical/professional skills as category → value rows. If skills are grouped (e.g. 'Languages: Python, Go'), use category='Languages', value='Python, Go'. If they are an ungrouped list, use category='' and put the comma-joined list in value.",
  "- areasOfExpertise: short competency keywords/phrases if the resume has a distinct 'Areas of Expertise' / 'Core Competencies' block; otherwise leave empty.",
  "- projects, certifications, languages: fill only if the resume clearly has them.",
  "Return plain text in every field (no HTML, no markdown).",
].join("\n");

// Parse extracted resume text into our structured ResumeData subset. Throws on
// model/transport errors (the route maps those to a 502 and credit alerts).
export async function extractResumeFromText(
  text: string,
  model: LanguageModel
): Promise<ExtractedResume> {
  const { object } = await generateObject({
    model,
    schema: extractionSchema,
    system: SYSTEM_PROMPT,
    // Cap the input so a pathological upload can't blow the context / cost.
    prompt: `Resume text:\n\n${text.slice(0, 24000)}`,
    maxOutputTokens: 4000,
  });
  return object;
}
