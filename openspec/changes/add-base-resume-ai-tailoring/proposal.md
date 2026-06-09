# Proposal: Add Base Resume and AI Tailoring

## Summary

Introduce the concept of a **Base Resume** in ResumeFlow and use it as the
default source for AI-generated, job-description-tailored resume versions. The
tailoring is section-by-section and truth-preserving (it may rephrase, reorder,
and select existing content but never invents facts), reuses the existing AI
access layer (BYOK key + per-user daily cap), and produces a new resume version
for the user to review before saving.

## Problem

Users may create many resume versions for different job applications. Over time,
tailored resumes drift away from the user's true core profile, and it becomes
unclear which version is the trusted source.

Users need a clean master resume that is not influenced by any job description
and can be used as the trusted source for future tailored resumes.

## Concept

The Base Resume is like the `main` branch in Git: the clean, pure, best version
of the user's resume. It contains the user's core skills, experience,
achievements, education, certifications, technical skills, areas of expertise,
and custom sections. It must not be influenced by any job description.

When a user generates a resume for a job description, the Base Resume is selected
as the source by default. The user may instead choose another existing resume
version as the source.

## Goals

- Designate exactly one resume version as the Base Resume at a time.
- Use the Base Resume as the default source for AI tailoring; allow choosing
  another version as source.
- Generate a new tailored resume version from a source resume + job description.
- Never overwrite the Base Resume (or any source) during tailoring.
- Store metadata recording the source resume and a snapshot of the job context.
- Tailor section-by-section and prevent the AI from inventing experience,
  skills, certifications, companies, dates, or achievements.
- Show a tailoring summary with section-level changes before the version is
  saved.

## Non-goals

- Do not change authentication or the Google Drive storage architecture.
- Do not remove or change existing resume versioning.
- Do not overwrite existing resumes during tailoring.
- Do not force every resume to be generated from the Base Resume.
- Do not add a new AI provider — reuse the existing OpenRouter integration,
  `resolveAiAccess()` gating, and credit-exhaustion handling.

## Reuse of existing AI infrastructure

This change builds on the AI layer already in the codebase:

- `lib/aiServer.ts` (`resolveAiAccess`, `openrouterModel`) for BYOK-vs-app-key
  selection and the per-user daily cap.
- `lib/aiNotify.ts` for owner notification when the shared credit is exhausted.
- The structured-output pattern used in `app/api/ai/route.ts` (`generateObject`
  + `jsonSchema`).

A full-resume tailoring run is much more token-heavy than the existing
single-section "Improve with AI" call, so the cap is checked **once per run**
(one unit per tailoring), and BYOK is recommended for heavy use.

## Supersedes

The current `tailor-resume` action in `components/AiActions.tsx` /
`app/api/ai/route.ts` only returns free-text *suggestions*. This change
repurposes that entry point to launch the new structured tailoring flow that
produces an actual new resume version.

## Success Criteria

- The user can mark one resume as the Base Resume; the resume list clearly shows
  which one it is.
- Tailored generation defaults its source to the Base Resume and lets the user
  pick another version.
- Tailoring creates a new resume version and leaves the source (and Base Resume)
  unchanged.
- The new version stores its source resume id and a job-context snapshot
  (company, job title, job id, job description) plus tailoring metadata.
- Tailoring is section-by-section and truth-preserving: immutable facts
  (companies, titles, dates, education, certifications) are carried verbatim and
  any AI-introduced fact is rejected.
- The user sees a section-level change summary and can accept or discard before
  the version is saved.
