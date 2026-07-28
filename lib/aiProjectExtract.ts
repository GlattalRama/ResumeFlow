// Project & Domain Experience AI extraction.
//
// Turns free-form source material — pasted text, text pulled from an uploaded
// PDF/DOCX, and/or screenshots — into structured project records: what the
// project was (name, client, domain, description, tech stack) and the user's
// part in it (role, roles-&-responsibilities bullets, achievements).
//
// PERSISTS NOTHING — returns drafts the client shows for review; the user
// edits and saves them through the normal /api/project-experience path.
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import type { ProjectExperience } from "./types";

// The extracted draft: a ProjectExperience minus server-assigned fields.
export type ExtractedProject = Omit<
  ProjectExperience,
  "id" | "createdAt" | "updatedAt"
>;

export interface SourceImage {
  // e.g. "image/png", "image/jpeg", "image/webp"
  mediaType: string;
  data: Uint8Array;
}

const extractionSchema = jsonSchema<{ projects: ExtractedProject[] }>({
  type: "object",
  additionalProperties: false,
  properties: {
    projects: {
      type: "array",
      description:
        "Every distinct project described in the source material. One entry per project — never merge different projects.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description:
              "Project or product name. If unnamed, a short descriptive title (e.g. 'Core banking batch migration').",
          },
          client: {
            type: "string",
            description:
              "Client or employer the project was delivered for. Empty string if not stated.",
          },
          domain: {
            type: "string",
            description:
              "Business domain / industry, e.g. 'Private banking', 'Retail', 'Healthcare claims'. Empty string if truly unclear.",
          },
          description: {
            type: "string",
            description:
              "2-4 sentence description of what the project/product is and what it does — the business context, not the person's tasks.",
          },
          techStack: {
            type: "string",
            description:
              "Comma-separated tools, technologies, platforms and methods used on the project (e.g. 'IBM z/OS, COBOL, DB2, JCL, Endevor').",
          },
          role: {
            type: "string",
            description:
              "The candidate's role title on the project, e.g. 'Lead Mainframe Engineer'. Empty string if not stated.",
          },
          responsibilities: {
            type: "array",
            items: { type: "string" },
            description:
              "Roles & responsibilities: 3-8 bullets of what the candidate personally did, owned, or led on this project. Start each with a verb.",
          },
          achievements: {
            type: "array",
            items: { type: "string" },
            description:
              "Notable outcomes/achievements with metrics when stated. Empty array if none are given.",
          },
          period: {
            type: "string",
            description:
              "When the project ran, free-form (e.g. 'Jan 2020 – Mar 2022'). Empty string if not stated.",
          },
        },
        required: [
          "name",
          "client",
          "domain",
          "description",
          "techStack",
          "role",
          "responsibilities",
          "achievements",
          "period",
        ],
      },
    },
  },
  required: ["projects"],
});

const SYSTEM = [
  "You extract structured PROJECT EXPERIENCE records from a candidate's source material (project write-ups, appraisal documents, case studies, screenshots).",
  "Rules:",
  "- Extract ONLY what the source states or clearly implies. Never invent projects, employers, technologies, metrics, or dates.",
  "- One record per distinct project. If the material describes a single project, return exactly one record.",
  "- 'description' is about the PROJECT (business context); 'responsibilities' are about the CANDIDATE (what they personally did).",
  "- Keep the candidate's first-person claims but write bullets in resume style (verb-first, no 'I').",
  "- Write every field in the same language as the source material.",
  "- Plain text only in every field — no markdown, no HTML.",
].join("\n");

// Extract projects from text and/or images. At least one of `text` / `images`
// must be non-empty (the route validates this).
export async function extractProjects(
  model: LanguageModel,
  text: string,
  images: SourceImage[]
): Promise<ExtractedProject[]> {
  const content: (
    | { type: "text"; text: string }
    | { type: "image"; image: Uint8Array; mediaType: string }
  )[] = [];
  const trimmed = text.trim();
  if (trimmed) {
    // Cap the input so a pathological upload can't blow the context / cost.
    content.push({
      type: "text",
      text: `Source material:\n\n${trimmed.slice(0, 32000)}`,
    });
  }
  for (const img of images) {
    content.push({ type: "image", image: img.data, mediaType: img.mediaType });
  }

  const { object } = await generateObject({
    model,
    schema: extractionSchema,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    maxOutputTokens: 4000,
  });

  // Normalize: trim strings, drop empty bullets, drop records with no
  // substance (no name AND no responsibilities).
  return object.projects
    .map((p) => ({
      name: p.name?.trim() ?? "",
      client: p.client?.trim() ?? "",
      domain: p.domain?.trim() ?? "",
      description: p.description?.trim() ?? "",
      techStack: p.techStack?.trim() ?? "",
      role: p.role?.trim() ?? "",
      responsibilities: (p.responsibilities ?? [])
        .map((r) => r.trim())
        .filter(Boolean),
      achievements: (p.achievements ?? []).map((a) => a.trim()).filter(Boolean),
      period: p.period?.trim() ?? "",
    }))
    .filter((p) => p.name || p.responsibilities.length > 0);
}
