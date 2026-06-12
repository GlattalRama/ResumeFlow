// Truth-preserving AI resume tailoring engine.
//
// Tailoring rephrases / reorders / selects EXISTING resume content to target a
// job description — it never invents experience, skills, companies, dates, or
// metrics. Sections are split into:
//
//   • Mutable  — summary (rephrase), experience highlights (rephrase + trim),
//                skills and areas of expertise (reorder / select).
//   • Immutable — everything else (identity, company/role/dates, education,
//                certifications, languages, projects, custom sections, skill
//                categories) is copied verbatim from the source.
//
// The model's proposals pass through assembleTailoredResume(), a PURE function
// that verifies each proposal against the source and falls back to the source
// content when a proposal introduces an unverifiable fact (a new skill/area, a
// new numeric figure, or more highlights than the source had). This is the real
// guardrail — not the prompt — so it is exported and unit-tested independently.
import { generateObject, jsonSchema, type LanguageModel } from "ai";
import type { ResumeData, SectionChange } from "./types";

export interface TailorJob {
  company: string;
  jobTitle: string;
  jobDescription: string;
}

// Model-supplied one-line justifications per change, keyed for the review UI
// ("why was this rewritten"). Advisory only — never part of verification.
export interface TailorReasons {
  summary?: string;
  experience?: Record<number, string>;
  skills?: string;
  areasOfExpertise?: string;
  skillCategories?: string;
}

export interface TailorResult {
  resumeData: ResumeData;
  sectionChanges: SectionChange[];
  reasons: TailorReasons;
}

// Raw, unverified proposals from the model. Any field may be absent (that
// section's AI call failed or was skipped) — absent ⇒ keep the source verbatim.
export interface TailorProposals {
  summary?: { text: string; reason?: string };
  experienceHighlights?: { index: number; highlights: string[]; reason?: string }[];
  skills?: { items: string[]; reason?: string };
  areasOfExpertise?: { items: string[]; reason?: string };
  // Technical Skills rows, proposed as their display labels ("Category: value");
  // verified by identity against the source rows and mapped back.
  skillCategories?: { items: string[]; reason?: string };
}

// ── small text utilities ──────────────────────────────────────────────────

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

// Extract numeric figures (counts, percentages, money, multipliers) so we can
// check the model didn't introduce a metric absent from the source. Commas are
// stripped so "1,000" and "1000" compare equal.
export function numberTokens(text: string): Set<string> {
  const out = new Set<string>();
  const matches = text.match(/\d+(?:[.,]\d+)*\+?%?/g) ?? [];
  for (const m of matches) {
    const cleaned = m.replace(/,/g, "");
    if (/\d/.test(cleaned)) out.add(cleaned);
  }
  return out;
}

// All free-text from the source, used to validate summary figures (a summary may
// legitimately surface a metric that appears elsewhere in the resume).
function allSourceText(d: ResumeData): string {
  const parts: string[] = [d.basics.summary || ""];
  for (const exp of d.experience || [])
    parts.push(...(exp.highlights || []).map(stripHtml));
  parts.push(...(d.skills || []));
  parts.push(...(d.areasOfExpertise || []));
  for (const c of d.skillCategories || []) parts.push(c.value);
  for (const p of d.projects || []) parts.push(stripHtml(p.description || ""));
  return parts.join(" ");
}

// Verify a reorder/select proposal for a flat string list: every proposed item
// must already exist in the source (case-insensitive). On any new item, keep the
// source. Otherwise return the proposal remapped to the source's exact casing.
function verifyReorder(
  source: string[],
  proposed: string[] | undefined,
  changes: SectionChange[],
  key: string,
  label: string
): string[] {
  if (!proposed || proposed.length === 0) {
    changes.push({ section: key, changeType: "unchanged", note: "No change." });
    return source;
  }
  const cleaned = proposed.map((s) => s.trim()).filter(Boolean);
  const bySrc = new Map(source.map((s) => [norm(s), s]));
  const invented = cleaned.filter((s) => !bySrc.has(norm(s)));
  if (invented.length) {
    changes.push({
      section: key,
      changeType: "rejected",
      note: `Kept original ${label.toLowerCase()} — proposal added items not in the resume: ${invented
        .slice(0, 5)
        .join(", ")}.`,
    });
    return source;
  }
  // De-dupe while remapping to the source's canonical casing.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of cleaned) {
    const n = norm(s);
    if (seen.has(n)) continue;
    seen.add(n);
    result.push(bySrc.get(n)!);
  }
  const changed =
    result.length !== source.length || result.some((s, i) => s !== source[i]);
  changes.push({
    section: key,
    changeType: changed ? "reordered" : "unchanged",
    note: changed
      ? `Reordered/selected to surface job-relevant ${label.toLowerCase()} first.`
      : "No change.",
  });
  return result;
}

// ── pure verification + assembly ──────────────────────────────────────────

// Verify the model's proposals against the source and assemble the tailored
// ResumeData. Immutable sections are copied verbatim; mutable sections take the
// proposal only when it passes verification, otherwise fall back to the source.
export function assembleTailoredResume(
  source: ResumeData,
  proposals: TailorProposals
): TailorResult {
  const changes: SectionChange[] = [];
  const reasons: TailorReasons = {};
  // Start from a verbatim copy; mutable fields are overwritten below.
  const out: ResumeData = { ...source };

  // SUMMARY — rephrase; reject if it introduces figures absent from the resume.
  const proposedSummary = proposals.summary?.text?.trim();
  if (proposedSummary) {
    const sourceNums = numberTokens(allSourceText(source));
    const invented = [...numberTokens(proposedSummary)].filter(
      (n) => !sourceNums.has(n)
    );
    if (invented.length) {
      out.basics = source.basics;
      changes.push({
        section: "summary",
        changeType: "rejected",
        note: `Kept original — proposed summary introduced unverifiable figures: ${invented
          .slice(0, 5)
          .join(", ")}.`,
      });
    } else {
      out.basics = { ...source.basics, summary: proposedSummary };
      if (proposals.summary?.reason) reasons.summary = proposals.summary.reason;
      changes.push({
        section: "summary",
        changeType: "rephrased",
        note: proposals.summary?.reason || "Rewritten to foreground job-relevant strengths.",
      });
    }
  } else {
    out.basics = source.basics;
    changes.push({ section: "summary", changeType: "unchanged", note: "No change." });
  }

  // EXPERIENCE highlights — per entry: count must not grow and no new figures.
  // Company / role / location / dates are never sent to the model; copied as-is.
  const sourceExp = source.experience || [];
  const byIndex = new Map(
    (proposals.experienceHighlights || []).map((e) => [e.index, e])
  );
  let expChanged = false;
  let expRejected = false;
  out.experience = sourceExp.map((exp, i) => {
    const prop = byIndex.get(i)?.highlights;
    if (!prop) return exp;
    const cleaned = prop.map((h) => stripHtml(h)).filter(Boolean);
    const srcHls = exp.highlights || [];
    const srcNums = numberTokens(srcHls.map(stripHtml).join(" "));
    const invented = [...numberTokens(cleaned.join(" "))].filter(
      (n) => !srcNums.has(n)
    );
    if (cleaned.length === 0 || cleaned.length > srcHls.length || invented.length) {
      expRejected = true;
      return exp; // keep source highlights
    }
    expChanged = true;
    const reason = byIndex.get(i)?.reason;
    if (reason) {
      reasons.experience = { ...(reasons.experience ?? {}), [i]: reason };
    }
    return { ...exp, highlights: cleaned };
  });
  if (expChanged && expRejected) {
    changes.push({
      section: "experience",
      changeType: "rephrased",
      note: "Some entries sharpened toward the job; others kept verbatim (failed fact/length check).",
    });
  } else if (expChanged) {
    changes.push({
      section: "experience",
      changeType: "rephrased",
      note: "Highlights sharpened toward the job; companies, titles, and dates preserved.",
    });
  } else if (expRejected) {
    changes.push({
      section: "experience",
      changeType: "rejected",
      note: "Kept original highlights — proposals failed fact/length checks.",
    });
  } else {
    changes.push({ section: "experience", changeType: "unchanged", note: "No change." });
  }

  // SKILLS and AREAS OF EXPERTISE — reorder / select from existing items only.
  out.skills = verifyReorder(
    source.skills || [],
    proposals.skills?.items,
    changes,
    "skills",
    "Skills"
  );
  if (proposals.skills?.reason && out.skills !== source.skills) {
    reasons.skills = proposals.skills.reason;
  }
  out.areasOfExpertise = verifyReorder(
    source.areasOfExpertise || [],
    proposals.areasOfExpertise?.items,
    changes,
    "areasOfExpertise",
    "Areas of Expertise"
  );
  if (
    proposals.areasOfExpertise?.reason &&
    out.areasOfExpertise !== source.areasOfExpertise
  ) {
    reasons.areasOfExpertise = proposals.areasOfExpertise.reason;
  }

  // TECHNICAL SKILLS rows — reorder/select by display-label identity, then map
  // the verified labels back to the original row objects.
  {
    const srcRows = source.skillCategories || [];
    const labels = srcRows.map(skillRowLabel);
    const verified = verifyReorder(
      labels,
      proposals.skillCategories?.items,
      changes,
      "skillCategories",
      "Technical Skills"
    );
    const rowByLabel = new Map(srcRows.map((r) => [norm(skillRowLabel(r)), r]));
    out.skillCategories =
      verified === labels ? srcRows : verified.map((l) => rowByLabel.get(norm(l))!);
    if (proposals.skillCategories?.reason && verified !== labels) {
      reasons.skillCategories = proposals.skillCategories.reason;
    }
  }

  return { resumeData: out, sectionChanges: changes, reasons };
}

// Display label used as the identity of a Technical Skills row when sending it
// to the model and verifying the reorder proposal.
export function skillRowLabel(row: { category: string; value: string }): string {
  return row.category.trim() ? `${row.category.trim()}: ${row.value}` : row.value;
}

// ── AI proposal generation ────────────────────────────────────────────────

const summarySchema = jsonSchema<{ summary: string; reason: string }>({
  type: "object",
  properties: {
    summary: { type: "string" },
    reason: {
      type: "string",
      description:
        "One short sentence explaining how the rewrite targets the job (e.g. which JD requirement it foregrounds).",
    },
  },
  required: ["summary", "reason"],
  additionalProperties: false,
});

const highlightsSchema = jsonSchema<{
  entries: { index: number; highlights: string[]; reason: string }[];
}>({
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          highlights: { type: "array", items: { type: "string" } },
          reason: {
            type: "string",
            description:
              "One short sentence: which job requirement these rewritten bullets now speak to.",
          },
        },
        required: ["index", "highlights", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["entries"],
  additionalProperties: false,
});

const listSchema = jsonSchema<{ items: string[]; reason: string }>({
  type: "object",
  properties: {
    items: { type: "array", items: { type: "string" } },
    reason: {
      type: "string",
      description:
        "One short sentence explaining the reordering/selection against the job.",
    },
  },
  required: ["items", "reason"],
  additionalProperties: false,
});

function jobHeader(job: TailorJob): string {
  return [
    `Target role: ${job.jobTitle || "(unknown)"} at ${job.company || "(unknown)"}`,
    "Job description:",
    job.jobDescription?.trim()
      ? stripHtml(job.jobDescription).slice(0, 4000)
      : "(none provided)",
  ].join("\n");
}

// Run the mutable-section model calls (in parallel, each failure-isolated) to
// build raw proposals, then verify + assemble via assembleTailoredResume. The
// caller supplies the model handle (see lib/aiServer.openrouterModel) and is
// responsible for daily-cap accounting (one run = one unit).
export async function tailorResumeData(
  source: ResumeData,
  job: TailorJob,
  model: LanguageModel
): Promise<TailorResult> {
  const header = jobHeader(job);

  const summaryCall = async (): Promise<TailorProposals["summary"]> => {
    if (!source.basics.summary?.trim()) return undefined;
    const { object } = await generateObject({
      model,
      schema: summarySchema,
      system:
        "You are a professional resume writer. Rewrite the candidate's professional summary to target the job below: concise (2-3 sentences), active voice, leading with the strengths most relevant to this role. Do NOT invent facts or figures not present in the original. Return PLAIN TEXT only, plus a one-sentence reason tying the rewrite to the job description.",
      prompt: `${header}\n\nCurrent summary:\n${stripHtml(source.basics.summary)}`,
      maxOutputTokens: 500,
    });
    return { text: object.summary, reason: object.reason };
  };

  const highlightsCall = async (): Promise<
    TailorProposals["experienceHighlights"]
  > => {
    const exp = source.experience || [];
    const entries = exp
      .map((e, index) => ({
        index,
        role: e.role,
        company: e.company,
        highlights: (e.highlights || []).map(stripHtml).filter(Boolean),
      }))
      .filter((e) => e.highlights.length > 0);
    if (entries.length === 0) return undefined;
    const { object } = await generateObject({
      model,
      schema: highlightsSchema,
      system:
        "You are a professional resume writer. For each work-experience entry, rewrite its highlight bullets to emphasize relevance to the job below. Rules: keep the SAME `index`; return NO MORE bullets than the entry started with; rephrase only — do NOT invent metrics, tools, employers, or achievements that aren't in the original bullets; one achievement per string, no leading dashes. Per entry, also give a one-sentence reason tying the rewrite to the job description. Return plain text.",
      prompt: `${header}\n\nEntries (JSON):\n${JSON.stringify(entries)}`,
      maxOutputTokens: 1600,
    });
    return object.entries;
  };

  const listCall = async (
    items: string[],
    kind: string
  ): Promise<{ items: string[]; reason?: string } | undefined> => {
    if (!items || items.length === 0) return undefined;
    const { object } = await generateObject({
      model,
      schema: listSchema,
      system: `You are a professional resume writer. From the candidate's ${kind} list, REORDER and optionally drop items so the most relevant to the job below come first. You MUST NOT add any item that is not already in the list, and MUST NOT reword items. Return the items exactly as given (same spelling), reordered/selected, plus a one-sentence reason tying the ordering to the job description.`,
      prompt: `${header}\n\n${kind} (JSON array):\n${JSON.stringify(items)}`,
      maxOutputTokens: 600,
    });
    return { items: object.items, reason: object.reason };
  };

  // Failure-isolate each section: a thrown/failed call yields `undefined`, which
  // assembleTailoredResume treats as "keep the source for that section".
  const settle = async <T>(p: Promise<T>): Promise<T | undefined> => {
    try {
      return await p;
    } catch (err) {
      console.error("tailorResumeData section failed:", err);
      return undefined;
    }
  };

  const [summary, experienceHighlights, skills, areasOfExpertise, skillCategories] =
    await Promise.all([
      settle(summaryCall()),
      settle(highlightsCall()),
      settle(listCall(source.skills || [], "skills")),
      settle(listCall(source.areasOfExpertise || [], "areas of expertise")),
      settle(
        listCall(
          (source.skillCategories || []).map(skillRowLabel),
          "technical skill rows"
        )
      ),
    ]);

  return assembleTailoredResume(source, {
    summary,
    experienceHighlights,
    skills,
    areasOfExpertise,
    skillCategories,
  });
}
