# Tasks: Base Resume and AI Tailoring

## 1. Data model

- [x] Add `baseResumeId?: string` to `UserSettings` in `lib/types.ts`.
- [x] Add `origin?: "manual" | "tailored"`, `sourceResumeId?`, and
      `tailoredMetadata?` to `ResumeVersion`.
- [x] Add `TailoredResumeMetadata` and `SectionChange` types.
- [x] Confirm consumers default `origin` to `"manual"` for older records.
      (Field is optional; no current consumers — documented in the type.)

## 2. Base Resume designation (pointer)

- [x] Add settings helpers to read/set/clear `baseResumeId`
      (`setBaseResumeId` in `lib/aiSettings.ts`; resolution in `lib/baseResume.ts`).
      Refactored the settings singleton through one `patchSettings` merge so
      partial writes can't drop `baseResumeId`.
- [x] Resolve "is base" by comparing a version id to `baseResumeId`, treating a
      dangling pointer as "no base set" (`resolveBaseResumeId`, `isBaseResume`).
- [x] API: set/clear the Base Resume pointer (`app/api/base-resume/route.ts`:
      GET / POST / DELETE).

## 3. Resume list UI

- [x] Show a "Base Resume" badge on the matching version (list cards + preview
      header; `components/BaseResumeControl.tsx`).
- [x] Add a "Set as Base Resume" action on other versions (list cards +
      `components/ResumePreviewActions.tsx`).
- [x] Require strong confirmation to delete the Base Resume (two-step confirm in
      `ResumePreviewActions`); clear the pointer on delete (in the resume DELETE
      route).

## 4. Truth-preserving tailoring engine (`lib/aiTailor.ts`)

- [x] Classify sections as mutable (summary, experience highlights, skills,
      areas) vs immutable (everything else, copied verbatim).
- [x] Build per-section prompts + `jsonSchema` constraints; bounded to ~4 model
      calls per run (summary, all-experience, skills, areas), failure-isolated.
- [x] Copy immutable sections verbatim from the source `resumeData`.
- [x] Post-generation verification (`assembleTailoredResume`, pure): reject
      proposals that introduce new skills/areas, new numeric figures, or grow a
      highlight count; fall back to source. Unit-tested (21/21).
- [x] resumeData assembly preserves all source fields; `templateStyle`,
      `formCardState`, `sectionState` carry forward at the save step (Group 5/6).
- [x] Produce `sectionChanges` summary (rephrased / reordered / rejected /
      unchanged per section).

## 5. API endpoint (`app/api/ai/tailor/route.ts`)

- [x] `POST /api/ai/tailor` returns a draft `{ resumeData, sectionChanges,
      metadata }` and does NOT persist.
- [x] Gate via `resolveAiAccess()`; one cap unit per run (inputs validated
      first, so bad requests don't burn a unit).
- [x] Reuse `isCreditsError` / `notifyOwnerCreditsExhausted` on shared-key
      credit exhaustion (502 on other errors).
- [x] Read company/jobTitle/jobId/jobDescription from the application; snapshot
      the JD into `metadata`. Verified: 400 / 404×2 / 503 wiring.

## 6. Tailoring UX

- [x] Repurpose the "Tailor Resume for this Job" action to launch the flow
      (removed the text-only action from `AiActions`; added `TailorResumeFlow`).
- [x] Source picker defaulting to the Base Resume → linked version → force pick.
- [x] Review screen with tailoring summary + section-level change badges +
      tailored-summary preview (accept / discard / regenerate).
- [x] On accept, create a new `ResumeVersion` with `origin: "tailored"`,
      `sourceResumeId`, `tailoredMetadata`, carrying the source version's
      template/style/layout. Save path verified (provenance persists).
- [x] Note BYOK recommendation for heavy use (in the modal copy).

## 7. Docs & verification

- [x] Update `openspec/project.md` (refreshed stale Stack + Features: real AI,
      Drive/auth, Base Resume + tailoring).
- [x] `openspec validate add-base-resume-ai-tailoring --strict` → valid.
- [x] `npm run typecheck` → clean.
- [x] Verified without a key: base set/get/clear/404, delete-clears-base,
      field-preservation, endpoint 400/404/503 gating, truth-preservation
      engine (21/21 unit tests), tailored-save provenance persistence, UI render.
- [ ] PENDING (needs an OpenRouter key, in-app): live tailor generation +
      accept-creates-version end-to-end, and that the cap increments once/run.
