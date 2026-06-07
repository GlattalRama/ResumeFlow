# Proposal: Redesign Dashboard

## Summary

Redesign the ResumeFlow dashboard from a plain card list into a modern, polished
SaaS-style overview: a personalized hero, metric cards, a visual application
pipeline, recent applications, recent resume versions with quick actions, and a
recent-activity feed — with friendly empty states throughout.

## Problem

The current dashboard is functional but plain: a generic page header, three flat
stat cards, a bulleted "applications by status" list, and a recent-applications
list. It does not greet the signed-in user, surface resume versions, show
interview-prep progress, or give a sense of activity over time. It reads as a
data dump rather than a useful home screen.

## Goals

- Personalized hero with a welcome-back message (using the signed-in user's
  name when available), a short description, and primary actions
  (New Resume, New Application).
- Modern metric cards for Resume Versions, Applications, Active Applications, and
  Interview Prep Items — each with a title, large number, helper text, and a
  subtle icon/accent.
- A visual application pipeline showing counts per status (not a plain list).
- Recent applications: company, job title, status badge, resume version used,
  last updated.
- Recent resume versions: version name, target role, selected template, last
  updated, and quick actions (Preview, Edit, Export).
- Recent activity derived from existing `createdAt` / `updatedAt` timestamps
  (resume created/updated, application created, status changed, note added,
  Q&A added).
- Friendly empty states with action buttons when there are no resumes or
  applications.
- Modern, responsive, uncluttered layout using the existing design tokens.

## Non-goals

- No changes to authentication or Google Drive storage logic.
- No changes to the application status model. The pipeline visualizes the
  existing `ApplicationStatus` values (Saved, Applied, Phone Screen, Interview,
  Offer, Rejected, Withdrawn); it does not add or rename statuses.
- No new activity-tracking storage. Recent activity is derived from existing
  records' timestamps and the existing status-history collection.
- No changes to the resumes or applications list pages beyond what the dashboard
  links to.

## Success Criteria

- The dashboard greets the user by name when signed in and shows the hero
  actions.
- All four metric cards render correct counts with distinct accents.
- The pipeline shows every status with a proportional visual bar and count.
- Recent applications and recent resume versions show the required fields and
  quick actions and link to the right pages.
- Recent activity merges multiple event types in reverse-chronological order.
- Empty states appear (with CTAs) when the relevant data is missing.
- The page is responsive and `tsc --noEmit` passes.
