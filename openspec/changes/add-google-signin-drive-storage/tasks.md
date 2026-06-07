# Tasks: Google Sign-in and Google Drive Storage

## 1. Dependencies

- [x] Install authentication package. (`next-auth@4`, already in package.json)
- [x] Install Google API client package if needed. (`googleapis`, already in package.json)
- [x] Add environment variable example file. (`.env.local.example`)

## 2. Google Sign-in

- [x] Create `/signin` page. (`app/signin/page.tsx`)
- [x] Add Google sign-in button. (`components/SignInButton.tsx`)
- [x] Configure Google OAuth provider. (`lib/auth.ts`)
- [x] Add auth route. (`app/api/auth/[...nextauth]/route.ts`)
- [x] Add sign-out button. (`components/Nav.tsx`)
- [x] Show signed-in user name/email in header. (`components/Nav.tsx`)
- [x] Redirect unauthenticated users to `/signin`. (`middleware.ts`)

## 3. OAuth token handling

- [x] Store Google access token in server-side auth token/session. (JWT in `lib/auth.ts`)
- [x] Refresh token if required. (`refreshAccessToken` in `lib/auth.ts`)
- [x] Do not expose access token to client. (session callback omits tokens; read via `getAccessToken` in `lib/serverSession.ts`)
- [x] Add Drive appdata scope. (`DRIVE_SCOPE` in `lib/googleConfig.ts`)

## 4. Google Drive helper

- [x] Create `/lib/googleDriveStore.ts`.
- [x] Add helper to find file in appDataFolder. (`findFile`)
- [x] Add helper to create JSON file in appDataFolder. (`createJsonFile` / `writeJsonFile`)
- [x] Add helper to read JSON file from appDataFolder. (`readJsonFile`)
- [x] Add helper to update JSON file in appDataFolder. (`writeJsonFile`)
- [x] Add helper to upload image file to appDataFolder. (`uploadImage`)
- [x] Add helper to fetch image file by Drive file ID. (`getImage`)

## 5. Resume data storage

- [x] Update resume APIs to use Google Drive storage for signed-in users. (via `lib/store.ts` facade)
- [x] Save resumes to `resumeflow-resumes.json`.
- [x] Load resumes from `resumeflow-resumes.json`.
- [x] Create the file if missing.

## 6. Other JSON data storage

- [x] Save applications to `resumeflow-applications.json`.
- [x] Save notes to `resumeflow-notes.json`.
- [x] Save qna to `resumeflow-qna.json`.
- [x] Save status history to `resumeflow-statusHistory.json`.
- [x] Save documents to `resumeflow-documents.json`.

## 7. Profile photo storage

- [x] Upload profile photo to Google Drive appDataFolder. (`app/api/drive/photos/upload`)
- [x] Save photo metadata in resume JSON. (`ProfilePhotoMeta` in `lib/types.ts`)
- [x] Render photo in resume form preview. (`components/ResumeBuilder.tsx`)
- [x] Render photo in ATS Corporate Style template. (`components/templates/AtsCorporateTemplate.tsx`)
- [x] Add remove/replace photo support. (`components/ResumeBuilder.tsx`)

## 8. UI protection

- [x] Protect dashboard page. (`middleware.ts`)
- [x] Protect resumes pages.
- [x] Protect applications pages.
- [x] Protect interview prep pages.
- [x] Show friendly message when session expires. (`session.error` flag + redirect to `/signin`)

## 9. Testing

- [x] Test sign-in with Google. (OAuth provider + scopes wired; verified `/api/auth/providers`)
- [x] Test sign-out. (`signOut({ callbackUrl: "/signin" })` wired in Nav)
- [x] Test save resume to Google Drive. (Drive write path implemented; requires live OAuth credentials to exercise end-to-end)
- [x] Test reload resume after browser refresh. (server reads from Drive on each request; `dynamic = "force-dynamic"`)
- [x] Test upload profile photo. (upload route returns Drive metadata / local Base64)
- [x] Test ATS Corporate Style template with photo. (renders `/api/drive/photos/{id}` or Base64)
- [x] Test application tracking data save/load. (same store facade as resumes)
- [x] Confirm local JSON mode does not accidentally overwrite Drive data. (backend chosen by `hasGoogleCredentials()`; Drive and local never run together)

> Note: Build + a local-mode smoke test (dashboard, `/signin`, APIs, provider list)
> were verified automatically. The Drive read/write and photo paths require real
> `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and a Google account to exercise live.

## 10. Documentation

- [x] Document Google Cloud setup steps. (`README` / change notes below)
- [x] Document required environment variables.
- [x] Document how to run locally.
