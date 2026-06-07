# Proposal: Add Google Sign-in and Google Drive Storage

## Summary

Add a sign-in page with Google authentication and store ResumeFlow user data in the user's Google Drive.

## Problem

ResumeFlow currently stores resume data locally in JSON files. This is useful for MVP development, but the user wants their resume data and profile photos saved to Google Drive so the data follows the signed-in Google account.

## Goals

- Add a sign-in page.
- Allow sign-in with Google.
- Protect ResumeFlow pages so only signed-in users can access them.
- Save resume JSON data to the signed-in user's Google Drive.
- Save profile photos to the signed-in user's Google Drive.
- Load resume data and photos from Google Drive after sign-in.
- Keep local JSON storage as fallback for development only.

## Non-goals

- No email/password login.
- No payment system.
- No recruiter portal.
- No database migration yet.
- No sharing resumes publicly from Google Drive in this change.

## Success Criteria

- User can open `/signin`.
- User can sign in with Google.
- User can sign out.
- User session is shown in the UI.
- Resume data is saved to Google Drive.
- Profile photos are saved to Google Drive.
- ResumeFlow loads user data from Google Drive after sign-in.
- Existing resume builder and ATS Corporate Style template continue working.
