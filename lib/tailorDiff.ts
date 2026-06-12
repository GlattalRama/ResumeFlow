import type { ResumeData } from "./types";
import type { TailorReasons } from "./aiTailor";
import { skillRowLabel } from "./aiTailor";

// Pure helpers behind the tailoring review UI: word-level diffing, the list of
// reviewable changes between a source and a tailored resume, and assembly of
// the final ResumeData from the user's accept/reject choices.

// ── word-level diff ─────────────────────────────────────────────────────────

export type DiffPart = { type: "same" | "del" | "ins"; text: string };

// LCS-based word diff. Inputs are sentences/bullets (tens of words), so the
// O(n·m) table is trivially cheap.
export function diffWords(oldText: string, newText: string): DiffPart[] {
  const a = oldText.split(/\s+/).filter(Boolean);
  const b = newText.split(/\s+/).filter(Boolean);
  const m = a.length;
  const n = b.length;
  const eq = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();

  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], word: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += ` ${word}`;
    else parts.push({ type, text: word });
  };
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (eq(a[i], b[j])) {
      push("same", b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("ins", b[j++]);
    }
  }
  while (i < m) push("del", a[i++]);
  while (j < n) push("ins", b[j++]);
  return parts;
}

// ── reviewable changes ──────────────────────────────────────────────────────

export type TailorChange =
  | {
      key: string; // stable choice key, e.g. "summary", "exp:0", "skills"
      kind: "text";
      section: string; // display label
      reason?: string;
      before: string;
      after: string;
    }
  | {
      key: string;
      kind: "bullets";
      section: string;
      reason?: string;
      // Bullets paired by index; a missing `after` means the bullet was
      // dropped by the tailoring (trim).
      pairs: { before?: string; after?: string }[];
    }
  | {
      key: string;
      kind: "list";
      section: string;
      reason?: string;
      before: string[];
      after: string[];
      dropped: string[];
    };

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Compare source vs tailored and produce the reviewable change list. Keys are
// stable so the UI's rejected-set survives re-renders.
export function buildTailorChanges(
  source: ResumeData,
  tailored: ResumeData,
  reasons: TailorReasons | undefined
): TailorChange[] {
  const changes: TailorChange[] = [];

  const srcSummary = stripHtml(source.basics.summary || "");
  const newSummary = stripHtml(tailored.basics.summary || "");
  if (srcSummary !== newSummary) {
    changes.push({
      key: "summary",
      kind: "text",
      section: "Summary",
      reason: reasons?.summary,
      before: srcSummary,
      after: newSummary,
    });
  }

  (source.experience || []).forEach((srcExp, i) => {
    const newExp = tailored.experience?.[i];
    if (!newExp) return;
    const before = (srcExp.highlights || []).map(stripHtml);
    const after = (newExp.highlights || []).map(stripHtml);
    if (sameList(before, after)) return;
    const pairs: { before?: string; after?: string }[] = [];
    for (let k = 0; k < Math.max(before.length, after.length); k++) {
      pairs.push({ before: before[k], after: after[k] });
    }
    changes.push({
      key: `exp:${i}`,
      kind: "bullets",
      section:
        [srcExp.role, srcExp.company].filter(Boolean).join(" · ") ||
        `Experience ${i + 1}`,
      reason: reasons?.experience?.[i],
      pairs,
    });
  });

  const listChange = (
    key: string,
    section: string,
    before: string[],
    after: string[],
    reason?: string
  ) => {
    if (sameList(before, after)) return;
    const afterSet = new Set(after.map((s) => s.toLowerCase()));
    changes.push({
      key,
      kind: "list",
      section,
      reason,
      before,
      after,
      dropped: before.filter((s) => !afterSet.has(s.toLowerCase())),
    });
  };
  listChange(
    "areas",
    "Areas of Expertise",
    source.areasOfExpertise || [],
    tailored.areasOfExpertise || [],
    reasons?.areasOfExpertise
  );
  listChange(
    "skills",
    "Skills",
    source.skills || [],
    tailored.skills || [],
    reasons?.skills
  );
  listChange(
    "skillCategories",
    "Technical Skills",
    (source.skillCategories || []).map(skillRowLabel),
    (tailored.skillCategories || []).map(skillRowLabel),
    reasons?.skillCategories
  );

  return changes;
}

// Assemble the final ResumeData from the user's choices: start from the
// tailored draft and revert every rejected change back to the source.
export function applyTailorChoices(
  source: ResumeData,
  tailored: ResumeData,
  rejected: ReadonlySet<string>
): ResumeData {
  const out: ResumeData = { ...tailored };
  if (rejected.has("summary")) {
    out.basics = { ...tailored.basics, summary: source.basics.summary };
  }
  out.experience = (tailored.experience || []).map((exp, i) =>
    rejected.has(`exp:${i}`) && source.experience?.[i] ? source.experience[i] : exp
  );
  if (rejected.has("areas")) out.areasOfExpertise = source.areasOfExpertise;
  if (rejected.has("skills")) out.skills = source.skills;
  if (rejected.has("skillCategories")) out.skillCategories = source.skillCategories;
  return out;
}
