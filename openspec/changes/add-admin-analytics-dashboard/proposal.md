# Proposal: Add Admin Analytics Dashboard

## Summary

Add an app-owner–only analytics dashboard to ResumeFlow that reports product
usage — logins, resumes created, job applications created, resume exports, and
AI-tailored resume generations — broken down by day, week, month, year, and
all-time. Analytics is **aggregate-only and privacy-friendly**: it stores
pre-bucketed counters in an app-owned store, never resume text, job
descriptions, photos, or any per-user content.

## Problem

ResumeFlow stores each user's resume data in that user's **own Google Drive
appDataFolder** (with a local-JSON dev fallback). There is deliberately **no
shared database**. That model is great for user privacy but leaves the app owner
with no way to answer basic adoption questions, because no single place sees
activity across users.

The app owner needs to know:

- how many users logged in (and how many were active)
- how many resumes were created
- how many job applications were created
- how many resumes were exported (and in which formats)
- how many AI-tailored resumes were generated
- all of the above by day / week / month / year / all-time

## Goals

- Add an **admin role**, controlled for MVP by an `ADMIN_EMAILS` env var.
- Track a small, fixed set of usage **events** as aggregate counters.
- Provide an admin-only dashboard that shows counts by time period.
- Keep analytics in an **app-owned** store, completely separate from the
  per-user Drive resume storage.
- Be **privacy-friendly**: store only counts in time buckets — no resume text,
  no job descriptions, no photos, no free-text PII.
- **Fail open**: if analytics is unconfigured or the store errors, the rest of
  the app keeps working.

## Non-goals

- Do not store full resume content, job-description content, or user photos.
- Do not store per-event rows with identifying detail (only bucketed counters,
  plus a privacy-preserving unique-user estimate).
- Do not build billing.
- Do not expose analytics to normal users.
- Do not change the Google Drive resume storage model or the auth provider.
- Do not add a per-user "your stats" view (this is owner analytics only).

## Reuse of existing infrastructure

- **Auth**: reuse the existing NextAuth Google sign-in session; admin gating is
  a check of the session email against `ADMIN_EMAILS`. The login event hooks the
  existing NextAuth `signIn` flow.
- **AI tailoring**: the tailored-resume event is emitted from the existing
  `app/api/ai/tailor/route.ts` accept path (the `origin: "tailored"` save).
- **Storage abstraction**: follow the existing "Drive when configured, local
  JSON in dev" pattern, but with an **app-owned** backend rather than per-user
  Drive (see `design.md` — Drive cannot aggregate across users).

## Success Criteria

- An admin can open the analytics dashboard; a normal user gets 403 / not-found.
- Admin access is determined by `ADMIN_EMAILS`; with it unset, no one is admin.
- The dashboard shows totals and day/week/month/year/all-time counts for:
  logins (and active users), resumes created, applications created, exports
  (split by format), and AI-tailored generations.
- No resume text, job description, or photo is ever written to the analytics
  store (verifiable from the event payload type — it has no such fields).
- With analytics disabled or the store failing, tracking is a no-op and no user
  action breaks.
