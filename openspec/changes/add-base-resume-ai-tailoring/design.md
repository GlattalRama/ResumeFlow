# Design: Base Resume and AI Tailoring

## Base Resume Concept

ResumeFlow shall introduce the concept of a Base Resume — the user's clean
master resume, similar to the `main` branch in Git. It represents the best pure
version of the user's profile and contains:

- core skills / technical skills
- core experience
- education
- certifications
- languages
- achievements
- areas of expertise
- custom sections

The Base Resume must not be influenced by any specific job description. It is the
source of truth for the user's career profile.

## Base Resume designation: a single pointer (not a per-record flag)

Rather than a per-version `isBaseResume: boolean` (which requires a fragile
"only one true" invariant maintained by a read-all → unset-old → set-new →
write-all cycle on the Drive JSON collection), the Base Resume is identified by a
**single pointer** stored on the settings singleton.

```ts
// lib/types.ts — UserSettings (existing singleton, add one field)
interface UserSettings {
  id: string;            // "singleton"
  provider: AiProvider;
  model: string;
  apiKeyEnc: string;
  usage?: { day: string; count: number };
  baseResumeId?: string; // NEW — id of the resume version designated as Base
  updatedAt: string;
}
```

A resume version *is* the Base Resume iff its `id === settings.baseResumeId`.

Benefits over a per-record boolean:

- **Atomic.** Setting the base is a single-record write to the settings
  singleton; no need to rewrite the whole resumes collection or risk clobbering
  concurrent resume edits.
- **No invariant to enforce.** "Exactly one" falls out of the data shape — a
  single id can only point at one version.
- **Self-healing.** If `baseResumeId` points at a deleted version, consumers
  treat it as "no base set" (they check the id still resolves to a version).

### Base Resume rules

- A user may have many resume versions; at most one is the Base Resume.
- Setting a new Base Resume simply overwrites `baseResumeId`; the previous base
  reverts to an ordinary version automatically.
- The resume list shows a clear **"Base Resume"** badge on the version whose id
  matches `baseResumeId`.
- Deleting the Base Resume requires a strong confirmation; on delete,
  `baseResumeId` is cleared.
- The Base Resume (and any source version) is **never** overwritten by tailoring
  — tailoring always creates a new version.
- When no base is set, tailoring falls back to the user-selected source; if none
  is selected, the most recently updated version is offered as the default.

## ResumeVersion data model updates

Extend `ResumeVersion` (existing fields preserved — note `templateStyle`,
`formCardState`, `sectionState` MUST be carried forward into tailored versions so
layout/section configuration is not lost):

```ts
interface ResumeVersion {
  // ── existing fields (unchanged) ──
  id: string;
  versionName: string;
  versionNumber: number;
  targetRole: string;
  selectedTemplate: TemplateId;
  templateStyle?: TemplateStyleSettings;
  formCardState?: ResumeFormCardState[];
  sectionState?: ResumeSectionState[];
  createdAt: string;
  updatedAt: string;
  resumeData: ResumeData;

  // ── new fields ──
  // How this version was produced. Older records default to "manual".
  origin?: "manual" | "tailored";
  // The version this one was derived from (for tailored versions).
  sourceResumeId?: string;
  // Present only on tailored versions.
  tailoredMetadata?: TailoredResumeMetadata;
}
```

The two dimensions are kept separate on purpose: `origin` is the *method*
(manual vs AI-tailored) and `sourceResumeId` is the *source* (which may be the
base resume or any other version). This avoids the earlier conflated enum
(`"baseResume" | "existingVersion" | "aiTailored"`).

```ts
interface TailoredResumeMetadata {
  sourceResumeId: string;
  applicationId?: string;        // application the tailoring was launched from
  company: string;
  jobTitle: string;
  jobId: string;
  // The JD is SNAPSHOTTED at generation time — the application's JD may change
  // later, but the tailored version records what it was actually tailored to.
  jobDescriptionSnapshot: string;
  model: string;                 // model that produced the tailoring
  generatedAt: string;           // ISO timestamp
  sectionChanges: SectionChange[];
}

interface SectionChange {
  // e.g. "summary", "experience", "skills", "areasOfExpertise"
  section: string;
  changeType: "rephrased" | "reordered" | "emphasized" | "unchanged" | "rejected";
  // Short human-readable explanation for the review/summary UI.
  note: string;
}
```

### Backward compatibility / bootstrap

- Existing resume versions have no `origin`; consumers default it to `"manual"`.
- Existing settings have no `baseResumeId`; treated as "no base set".
- No automatic base is chosen. The resume list surfaces a "Set as Base Resume"
  action; the tailoring flow prompts the user to pick a source when no base is
  set.

## Mutable vs immutable sections

Tailoring is constrained to protect the truth of the resume. Sections are
classified:

**Mutable** (the AI may rephrase / reorder / select, never add):
- Professional Summary — rephrased to foreground job-relevant strengths.
- Work Experience *highlights* — wording sharpened, bullets reordered, most
  relevant surfaced first. Bullet count must not increase.
- Skills / Technical Skills — reordered/emphasized to match the JD.
- Areas of Expertise — reordered/selected.

**Immutable** (copied verbatim from the source):
- Identity & contact (name, email, phone, location, website).
- Company names, role titles, and all dates.
- Education entries, certifications, languages.
- Project facts (name/description) — order may change, facts may not.
- Any numeric metric not already present in the source.

This classification both prevents hallucination and bounds token cost.

## Truth-preservation mechanism (not just a prompt instruction)

Prompting the model to "not invent" is insufficient. The design enforces it:

1. **Structured, per-section generation.** Each mutable section is generated with
   `generateObject` + a constrained `jsonSchema` (the pattern already used in
   `app/api/ai/route.ts`). Immutable sections are not sent to the model for
   rewriting — they are copied straight from the source `resumeData`.
2. **Post-generation verification pass.** After generation, the result is diffed
   against the source:
   - Immutable entities (company names, role titles, dates, degrees, certs,
     languages) in the assembled output MUST match the source set. Any new or
     altered immutable entity ⇒ the run reuses the source content for that
     section and records `changeType: "rejected"` in `sectionChanges`.
   - For mutable sections, no new bullet may appear (highlight count ≤ source),
     and any number/metric not present in the source bullet is rejected.
3. **Fail safe.** If a section fails verification or the model call errors, that
   section falls back to the verbatim source content; the overall tailoring still
   completes with the failure noted in the summary.

## AI access, cost, and limits

- Tailoring uses `resolveAiAccess()` (`lib/aiServer.ts`) exactly like the
  existing endpoints: prefer the user's BYOK key, else the shared app key.
- Because a run makes **several** model calls (one per mutable section), the
  daily cap is checked **once at the start of the run** (one unit per tailoring),
  not per section — `resolveAiAccess()` is called once and the returned key/model
  is reused for every section call.
- Credit exhaustion on the shared key is handled via
  `notifyOwnerCreditsExhausted` (`lib/aiNotify.ts`), as elsewhere.
- BYOK is recommended for heavy tailoring use (noted in the UI).

## API

A dedicated endpoint returns a **draft** (it does not persist anything):

```
POST /api/ai/tailor
  body: { sourceResumeId: string, applicationId: string }
        // company/jobTitle/jobId/jobDescription are read from the application;
        // the JD is snapshotted into the response metadata.
  200:  { resumeData: ResumeData,
          sectionChanges: SectionChange[],
          metadata: TailoredResumeMetadata }   // draft — NOT saved
  429:  daily cap reached (same message shape as /api/ai)
  503:  no AI key available
```

Saving happens only after the user accepts, via the existing resume-version
creation path, which writes a new `ResumeVersion` with `origin: "tailored"`,
`sourceResumeId`, and `tailoredMetadata`. The source and base are untouched.

## UX flow

1. **Entry point** — the application page's "Tailor Resume for this Job" action
   (currently text-only) launches the tailoring flow. The application already
   carries `jobDescription`, `company`, `jobTitle`, and `jobId`.
2. **Source picker** — defaults to the Base Resume; the user may choose any other
   version. If no base is set, the user must pick a source.
3. **Generation** — `POST /api/ai/tailor` returns the draft + section changes.
4. **Review before save** — mirroring the existing `ImproveButton`
   accept/discard pattern, the user sees a tailoring summary and section-level
   diff, then accepts (creates the new version) or discards (nothing saved).
5. **Resume list** — shows the "Base Resume" badge, a "Set as Base Resume"
   action, and a strong-confirm dialog when deleting the base.

## Out-of-scope notes

- No change to how resumes render or export — tailored versions are ordinary
  `ResumeVersion`s with the same `resumeData` shape.
- `openspec/project.md` currently states "No real AI API yet"; this is now stale
  (real OpenRouter AI is integrated) and is corrected as part of this change.
