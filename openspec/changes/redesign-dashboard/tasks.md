# Tasks: Redesign Dashboard

## 1. Hero section

- [x] Show welcome-back message using the signed-in user's name when available.
- [x] Show short description text.
- [x] Add primary "New Resume" button.
- [x] Add primary "New Application" button.

## 2. Metric cards

- [x] Add Resume Versions metric card.
- [x] Add Applications metric card.
- [x] Add Active Applications metric card.
- [x] Add Interview Prep Items metric card.
- [x] Give each card a title, large number, helper text, and icon/accent.

## 3. Application pipeline

- [x] Compute application counts per status.
- [x] Render the pipeline visually (proportional bars, not a plain list).
- [x] Show every status with its count.

## 4. Recent applications

- [x] Show company and job title.
- [x] Show status badge.
- [x] Show resume version used.
- [x] Show last updated date.

## 5. Recent resume versions

- [x] Show version name.
- [x] Show target role.
- [x] Show selected template.
- [x] Show last updated date.
- [x] Add Preview quick action.
- [x] Add Edit quick action.
- [x] Add Export quick action.

## 6. Recent activity

- [x] Derive activity events from createdAt/updatedAt and status history.
- [x] Include resume created, resume updated, application created, status
      changed, note added, and Q&A added events.
- [x] Sort events in reverse-chronological order and show the most recent.

## 7. Empty states

- [x] Friendly empty state with CTA when there are no resumes.
- [x] Friendly empty state with CTA when there are no applications.

## 8. UI / polish

- [x] Modern soft cards with clean spacing and subtle accents.
- [x] Responsive layout.
- [x] Verify build/typecheck passes.
