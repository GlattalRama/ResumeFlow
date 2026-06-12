import type { ResumeData } from "./types";
import { htmlToLines } from "./richText";

// Client-side ATS scoring: instant, free, and recomputed live as the user
// types. Two parts:
//   • Resume health (75 pts): formatting / completeness checks an ATS or a
//     recruiter skim would penalize.
//   • Keyword match (25 pts): coverage of keywords extracted from a pasted
//     job description. Without a JD the health score is rescaled to 100.
// This is a heuristic guide, not a vendor-exact ATS simulation.

export interface AtsCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  points: number;
  maxPoints: number;
  // Shown when the check is not a clean pass; phrased as the action to take.
  tip?: string;
}

export interface KeywordMatch {
  keyword: string;
  matched: boolean;
}

export interface AtsScoreResult {
  overall: number; // 0–100
  healthScore: number; // 0–100 (formatting/completeness subscore)
  keywordScore: number | null; // 0–100, null when no usable JD
  checks: AtsCheck[];
  advisories: string[]; // zero-point warnings (e.g. photo present)
  keywords: KeywordMatch[];
  matchedCount: number;
  hasJobDescription: boolean;
}

const HEALTH_MAX = 75;
const KEYWORD_MAX = 25;

export function scoreResume(data: ResumeData, jobDescription: string): AtsScoreResult {
  const checks: AtsCheck[] = [];
  const advisories: string[] = [];

  const summaryWords = countWords(htmlToLines(data.basics.summary).join(" "));
  const experience = data.experience ?? [];
  const highlights = experience.flatMap((e) => e.highlights ?? []).filter(Boolean);

  // ---- Contact info (10) ----
  {
    const hasEmail = Boolean(data.basics.email.trim());
    const hasPhone = Boolean(data.basics.phone.trim());
    const pts = (hasEmail ? 5 : 0) + (hasPhone ? 5 : 0);
    checks.push({
      id: "contact",
      label: "Contact info (email + phone)",
      status: pts === 10 ? "pass" : pts > 0 ? "warn" : "fail",
      points: pts,
      maxPoints: 10,
      tip:
        pts === 10
          ? undefined
          : `Add your ${[!hasEmail && "email", !hasPhone && "phone number"]
              .filter(Boolean)
              .join(" and ")} so recruiters and ATS parsers can reach you.`,
    });
  }

  // ---- Professional summary (10) ----
  checks.push(
    summaryWords >= 25
      ? {
          id: "summary",
          label: "Professional summary",
          status: "pass",
          points: 10,
          maxPoints: 10,
        }
      : {
          id: "summary",
          label: "Professional summary",
          status: summaryWords > 0 ? "warn" : "fail",
          points: summaryWords > 0 ? 5 : 0,
          maxPoints: 10,
          tip:
            summaryWords > 0
              ? "Expand the summary to 2–3 sentences (25+ words) — many ATSs surface it as the candidate snapshot."
              : "Add a 2–3 sentence summary; it's the first thing parsed and shown.",
        }
  );

  // ---- Experience completeness (10) ----
  {
    const total = experience.length;
    const complete = experience.filter(
      (e) => e.role.trim() && e.company.trim() && (e.startDate.trim() || e.endDate.trim())
    ).length;
    const status = total === 0 ? "fail" : complete === total ? "pass" : "warn";
    checks.push({
      id: "experience",
      label: "Experience entries have role, company, dates",
      status,
      points: total === 0 ? 0 : Math.round((complete / total) * 10),
      maxPoints: 10,
      tip:
        status === "pass"
          ? undefined
          : total === 0
            ? "Add your work experience — it's the section ATSs weight most."
            : `${total - complete} ${total - complete === 1 ? "entry is" : "entries are"} missing a role, company, or dates; ATSs use these to build your work timeline.`,
    });
  }

  // ---- Quantified achievements (15) ----
  {
    const quantified = highlights.filter((h) => /\d|%|\$/.test(h)).length;
    const ratio = highlights.length ? quantified / highlights.length : 0;
    const TARGET = 0.4;
    const pts = Math.round(Math.min(1, ratio / TARGET) * 15);
    checks.push({
      id: "quantified",
      label: `Quantified bullet points (${quantified} of ${highlights.length})`,
      status: ratio >= TARGET ? "pass" : quantified > 0 ? "warn" : "fail",
      points: highlights.length ? pts : 0,
      maxPoints: 15,
      tip:
        ratio >= TARGET
          ? undefined
          : "Add numbers to more bullets — team size, %, $, time saved. Aim for at least 4 in 10 bullets carrying a metric.",
    });
  }

  // ---- Concise bullets (5) ----
  {
    const long = highlights.filter((h) => countWords(h) > 32).length;
    checks.push({
      id: "concise",
      label: "Bullets are concise (≤ 32 words)",
      status: long === 0 ? "pass" : long <= 2 ? "warn" : "fail",
      points: long === 0 ? 5 : long <= 2 ? 3 : 0,
      maxPoints: 5,
      tip:
        long === 0
          ? undefined
          : `${long} ${long === 1 ? "bullet runs" : "bullets run"} past ~32 words — split or tighten them; skimmers and parsers both lose long lines.`,
    });
  }

  // ---- Skills (10) ----
  {
    const skillCount =
      (data.skillCategories ?? []).filter((s) => s.value.trim()).length +
      (data.areasOfExpertise ?? []).filter(Boolean).length;
    checks.push({
      id: "skills",
      label: "Skills / areas of expertise listed",
      status: skillCount >= 5 ? "pass" : skillCount > 0 ? "warn" : "fail",
      points: skillCount >= 5 ? 10 : skillCount > 0 ? 5 : 0,
      maxPoints: 10,
      tip:
        skillCount >= 5
          ? undefined
          : "List your hard skills explicitly — ATS keyword matching leans heavily on the skills section.",
    });
  }

  // ---- Education (5) ----
  {
    const has = (data.education ?? []).some((e) => e.school.trim() || e.degree.trim());
    checks.push({
      id: "education",
      label: "Education listed",
      status: has ? "pass" : "warn",
      points: has ? 5 : 0,
      maxPoints: 5,
      tip: has ? undefined : "Add your education — many ATS filters require it to be present.",
    });
  }

  // ---- Overall length (10) ----
  {
    const words = countWords(resumeCorpus(data));
    const status =
      words >= 300 && words <= 1100 ? "pass" : words >= 150 && words <= 1500 ? "warn" : "fail";
    checks.push({
      id: "length",
      label: `Resume length (${words} words)`,
      status,
      points: status === "pass" ? 10 : status === "warn" ? 5 : 0,
      maxPoints: 10,
      tip:
        status === "pass"
          ? undefined
          : words < 300
            ? "The resume reads thin — flesh out experience bullets toward roughly one full page (300+ words)."
            : "The resume is running long — trim toward two pages (~1,100 words); older roles can shrink to 1–2 bullets.",
    });
  }

  // ---- Zero-point advisories ----
  if (data.profilePhoto || data.profilePhotoMeta) {
    advisories.push(
      "A profile photo is set. Many ATS parsers choke on images — use the ATS-safe export when applying through portals."
    );
  }
  if (!data.basics.website.trim()) {
    advisories.push("Consider adding your LinkedIn or portfolio URL to the basics.");
  }

  const healthEarned = checks.reduce((sum, c) => sum + c.points, 0);
  const healthScore = Math.round((healthEarned / HEALTH_MAX) * 100);

  // ---- Keyword match vs the job description ----
  const jd = jobDescription.trim();
  const hasJobDescription = jd.length >= 40;
  let keywords: KeywordMatch[] = [];
  let keywordScore: number | null = null;
  if (hasJobDescription) {
    const corpus = ` ${resumeCorpus(data).toLowerCase()} `;
    keywords = extractKeywords(jd).map((keyword) => ({
      keyword,
      matched: matchesCorpus(corpus, keyword),
    }));
    const matched = keywords.filter((k) => k.matched).length;
    keywordScore = keywords.length ? Math.round((matched / keywords.length) * 100) : null;
  }

  const overall =
    keywordScore == null
      ? healthScore
      : Math.round(healthEarned + (keywordScore / 100) * KEYWORD_MAX);

  return {
    overall,
    healthScore,
    keywordScore,
    checks,
    advisories,
    keywords,
    matchedCount: keywords.filter((k) => k.matched).length,
    hasJobDescription,
  };
}

// Every text field of the resume joined into one searchable string.
function resumeCorpus(data: ResumeData): string {
  const parts: string[] = [
    data.basics.name,
    data.basics.title,
    data.basics.location,
    htmlToLines(data.basics.summary).join(" "),
    ...(data.areasOfExpertise ?? []),
    ...(data.skillCategories ?? []).flatMap((s) => [s.category, s.value]),
    ...(data.experience ?? []).flatMap((e) => [
      e.role,
      e.company,
      e.location,
      ...(e.highlights ?? []),
    ]),
    ...(data.education ?? []).flatMap((e) => [e.school, e.degree, e.field]),
    ...(data.projects ?? []).flatMap((p) => [p.name, p.description]),
    ...(data.certifications ?? []),
    ...(data.languages ?? []),
    ...(data.customSections ?? []).flatMap((c) => [
      c.title,
      c.freeText,
      ...(c.items ?? []).flatMap((it) => [it.category, it.value]),
    ]),
  ];
  return parts.filter(Boolean).join(" ");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// English + job-posting boilerplate that should never count as a keyword.
const STOPWORDS = new Set(
  `the and for with you your our are will that this have has from not can all
  able who what when where why how a an of to in on at as is it be by or we us
  they their them if but do does did been being was were which while would
  could should may might must shall than then there these those its also each
  per via etc more most other others such some any no nor only own same so too
  very just about above after again against before below between both during
  few further here into once out over under until up down off through new
  experience experienced years year team teams work working works role roles
  responsibilities responsibility responsible requirements required require
  requires preferred qualifications qualification skills skill ability
  abilities strong excellent good great knowledge understanding familiarity
  familiar proficiency proficient plus bonus join looking seeking candidate
  candidates ideal position job company opportunity opportunities benefits
  salary location remote hybrid onsite equal employer apply application nice
  well using use used including include includes within across help ensure
  ensuring closely related relevant degree field minimum least environment
  day-to-day day`.split(/\s+/)
);

// Extract ranked keywords from a job description: frequent unigrams, repeated
// bigram phrases, and acronyms (which get a boost — they're almost always
// hard requirements like JCL or SQL).
export function extractKeywords(jobDescription: string, limit = 18): string[] {
  // Trailing dots/dashes are sentence punctuation, not part of the term
  // (leading dots stay — ".net"). Re-checked against stopwords after cleanup.
  const tokens = (jobDescription.toLowerCase().match(/[a-z0-9+#.][a-z0-9+#./-]*/g) ?? [])
    .map((t) => t.replace(/[.\-/]+$/, ""))
    .filter(Boolean);
  const counts = new Map<string, number>();
  const usable = (t: string) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t);

  for (const t of tokens) {
    if (usable(t) && t.length >= 3) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  // Acronyms from the original casing (SQL, JCL, CICS…) get a strong boost.
  for (const acr of jobDescription.match(/\b[A-Z][A-Z0-9/+#]{1,7}\b/g) ?? []) {
    const t = acr.toLowerCase();
    if (!STOPWORDS.has(t)) counts.set(t, (counts.get(t) ?? 0) + 3);
  }
  // Repeated bigram phrases ("incident management", "data migration").
  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (usable(a) && usable(b) && a.length >= 3 && b.length >= 3) {
      const phrase = `${a} ${b}`;
      bigrams.set(phrase, (bigrams.get(phrase) ?? 0) + 1);
    }
  }
  for (const [phrase, n] of bigrams) {
    if (n >= 2) counts.set(phrase, n * 2); // phrases outrank their unigrams
  }

  // Rank by count; suppress unigrams that are words of an already-selected
  // phrase ("data migration" beats listing "data" and "migration" again).
  const selected: string[] = [];
  for (const [candidate] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (selected.length >= limit) break;
    const isPhrase = candidate.includes(" ");
    if (
      !isPhrase &&
      selected.some((s) => s.includes(" ") && s.split(" ").includes(candidate))
    ) {
      continue;
    }
    if (isPhrase) {
      const words = new Set(candidate.split(" "));
      for (let i = selected.length - 1; i >= 0; i--) {
        if (!selected[i].includes(" ") && words.has(selected[i])) {
          selected.splice(i, 1);
        }
      }
    }
    selected.push(candidate);
  }
  return selected;
}

function matchesCorpus(lowerCorpusPadded: string, keyword: string): boolean {
  // Word-ish boundary match; falls back to plain substring for keywords with
  // special characters (c++, ci/cd, .net).
  if (/^[a-z0-9 ]+$/.test(keyword)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`).test(
      lowerCorpusPadded
    );
  }
  return lowerCorpusPadded.includes(keyword);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
