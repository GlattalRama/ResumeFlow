# Proposal: Work Journal and Interview Coach

## Summary

Add two top-level features as separate main-navigation pages:

1. **Work Journal** (`/work-journal`) — capture project notes, achievements,
   tools, problems solved, impact, and metrics while they're fresh, then turn
   them into resume bullets and STAR stories with AI assistance.
2. **Interview Coach** (`/interview-coach`) — prepare interview questions and
   answers, grounded in the user's own evidence (Work Journal, Base Resume,
   selected resume version, the target application's job description, and
   application notes), with strict no-fabrication rules and review-before-save
   AI behavior.

They are deliberately separate pages (no merged "Career Prep" page, no tabs).

## Problem

Achievements are forgotten long before they're needed: details, metrics, and
context fade between doing the work and updating a resume or preparing for an
interview. And interview preparation today (the per-application Q&A page) is
not grounded in the user's actual material — answers aren't evidence-bound,
saved answers have no revision protocol, and there's no reuse of captured work
stories.

## Concept

The Work Journal is the user's evidence store — raw truth captured early. The
Interview Coach consumes that evidence (plus resume and application context)
in a strict priority order:

1. Work Journal
2. Base Resume
3. selected resume version
4. selected application / job description
5. application notes
6. general best practices only if needed

The AI must not invent experience. When evidence is missing it reports a gap,
explains what's missing, and suggests what to add to the Work Journal.

## AI answer protocol (Interview Coach)

- Saved answers are never regenerated or overwritten automatically.
- Regeneration requires explicit confirmation (server enforces with a 409
  unless `confirmRegenerate` is sent).
- AI revisions (improve / shorter / more detailed / STAR / more confident /
  more professional / align with resume tone) are shown first; only an
  explicit accept replaces the saved answer, and the accepted revision is
  recorded in `aiRevisionHistory` (before/after/instruction).
- The first AI answer is kept as `originalAiAnswer` for reference.

## Storage

Same architecture as every other collection (storage facade in `lib/store.ts`):

- `workJournal`: `/data/workJournal.json` locally,
  `resumeflow-workJournal.json` in Drive appData.
- `interviewCoach`: `/data/interviewCoach.json` locally,
  `resumeflow-interviewCoach.json` in Drive appData.

## Relationship to existing features

- The old per-application interview prep (`/interview-prep/[applicationId]`,
  `qna` collection) is kept working but removed from navigation; the
  application page's prep card now opens the Interview Coach pre-selected on
  that application ("Prepare Interview").
- Application notes stay on the application page; the Interview Coach reads
  them as evidence.

## Privacy

No journal content, question/answer text, resume content, job descriptions, or
note text is tracked in analytics. The analytics layer is counter-based
(event-type buckets only) and no new events were added for these features.

## Non-goals

- No changes to authentication or the Google Drive architecture beyond the two
  new JSON files.
- No removal of existing resume or application functionality.
- No migration of legacy `qna` items into the Interview Coach (possible
  follow-up).
