# Tasks: Work Journal and Interview Coach

## 1. Data model

- [x] `WorkJournalNote` in `lib/types.ts` (title, company, client, project,
      role, period, whatIDid, toolsTechnologies, problemSolved, impactResult,
      metrics, tags, resumeReady, linkedResumeId, linkedSection,
      generatedResumeBullets, starStory, createdAt, updatedAt).
- [x] `InterviewCoachEntry` in `lib/types.ts` (selectedApplicationId,
      selectedResumeId, question, answer, originalAiAnswer, answerFormat,
      tone, status, source, category, usedBaseResume, usedWorkJournal,
      evidenceUsed, gaps, aiRevisionHistory, createdAt, updatedAt) +
      `InterviewAnswerRevision` (action, before, after, instruction).
      Note: `category` added beyond the original spec so Flow B's question
      grouping persists; `starStory` added to WorkJournalNote so the generated
      STAR story survives reload.
- [x] Register both collections in `Collections` and
      `DRIVE_FILE_NAMES` (`resumeflow-workJournal.json`,
      `resumeflow-interviewCoach.json`); local files auto-create as
      `data/workJournal.json` / `data/interviewCoach.json`.
- [x] `INTERVIEW_QUESTION_CATEGORIES` in `lib/constants.ts` (client-safe).

## 2. Work Journal

- [x] CRUD API: `app/api/work-journal/route.ts` (GET/POST),
      `app/api/work-journal/[id]/route.ts` (GET/PATCH/DELETE).
- [x] AI API: `app/api/ai/work-journal/route.ts` — actions `bullets`,
      `improve`, `star` over one note; persists nothing (review-before-save).
- [x] AI lib: `lib/aiWorkJournal.ts` — evidence-bound prompts (note fields
      only, no invented facts), structured output via `generateObject`.
- [x] Add-to-resume API: `app/api/work-journal/add-to-resume/route.ts` —
      appends an approved bullet to a chosen experience entry on the Base
      Resume or any version, snapshots the resume first, records
      linkedResumeId/linkedSection on the note, rejects duplicates.
- [x] Page `/work-journal` (`app/work-journal/page.tsx` +
      `components/WorkJournal.tsx`): create/edit/delete, search, tag +
      resume-ready filters, AI previews with accept/dismiss, bullet rows with
      copy and add-to-resume picker.

## 3. Interview Coach

- [x] CRUD API: `app/api/interview-coach/route.ts` (GET with optional
      `?applicationId=`, POST), `app/api/interview-coach/[id]/route.ts`
      (GET/PATCH/DELETE). PATCH supports `appendRevision` — the only path by
      which an AI revision replaces a saved answer (records history first).
- [x] AI API: `app/api/ai/interview-coach/route.ts` — modes:
      - `questions` (Flow B): generates 14-20 questions from the JD +
        candidate evidence, grouped into Resume Based / Job Description Based /
        Technical / Behavioral / HR / Gap-Risk / Salary-Notice; persists only
        NEW questions as draft entries (dedup against existing).
      - `answer`: generates an evidence-grounded answer; 409 if a saved answer
        exists and `confirmRegenerate` was not sent; stores evidenceUsed,
        gaps, usedBaseResume, usedWorkJournal, originalAiAnswer (first only).
      - `revise`: returns a revised answer for review; persists nothing.
- [x] AI lib: `lib/aiInterviewCoach.ts` — evidence digest builder (journal →
      base resume → selected version → application/JD → notes), question
      generation, grounded answering with gaps, 7 revision actions.
- [x] Page `/interview-coach` (`app/interview-coach/page.tsx` +
      `components/InterviewCoach.tsx`): application selector with context
      (company/title/jobId/status/resume/notes/JD preview),
      "Generate Questions from Job Description", manual question input
      (Flow A), category-grouped entries, per-entry answer editor with
      generate/regenerate-with-confirm, format + tone, revision
      preview accept/reject, mark final, copy, evidence + gaps display,
      revision history.

## 4. Integration

- [x] Application detail page: "Prepare Interview" button →
      `/interview-coach?application=<id>` (replaces the old prep card link).
- [x] Nav "Interview Coach" → `/interview-coach`. Old
      `/interview-prep/[applicationId]` pages and `qna` data kept but
      unlinked.

## 5. Out of scope / follow-ups

- [ ] Migrate legacy `qna` items into Interview Coach entries.
- [ ] Quick-add journal entry from the application page.
- [ ] Use Work Journal evidence in resume tailoring.
