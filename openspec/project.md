# ResumeFlow Project

ResumeFlow is a resume builder and job application tracking portal.

Users can:
- create resumes from JSON data
- preview resumes in multiple templates
- save different resume versions
- link each resume version to job applications
- store job descriptions and job IDs
- track application status
- add notes
- prepare interview Q&A

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Storage: Google Drive appDataFolder when OAuth is configured; local JSON
  files (`/data`) as the development fallback. No database.
- Auth: Google sign-in (NextAuth); local dev mode runs without it.
- AI: real OpenRouter integration (Vercel AI SDK) for "Improve with AI" and
  resume tailoring — app-provided key with a per-user daily cap, or the user's
  own key (BYOK) for unlimited use.

## Main Features

- Resume builder
- Multiple resume templates
- Resume versioning
- Base Resume (clean master) + AI job-tailoring into new versions
- Job application tracking
- Notes
- Interview Q&A
- Status history
- Document metadata
- AI assistant (interview Q&A, briefing, cover letter, follow-up)
