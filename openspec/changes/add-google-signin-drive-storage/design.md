# Design: Google Sign-in and Google Drive Storage

## Authentication

Use Google Sign-in for ResumeFlow.

Create:

- /signin
- /api/auth/[...nextauth]/route.ts
- /auth.ts or equivalent auth configuration

The sign-in page shall show:

- ResumeFlow logo/name
- short product message
- "Sign in with Google" button

After sign-in, redirect user to dashboard.

## Required Environment Variables

Use these environment variables:

- AUTH_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

If using NextAuth v4 naming, also support:

- NEXTAUTH_SECRET
- NEXTAUTH_URL

## Google OAuth Scopes

Request scopes needed for:

- basic user profile
- email
- Google Drive file access for app data

Preferred Drive scope:

- https://www.googleapis.com/auth/drive.appdata

This scope should be used so ResumeFlow stores data in the user's app-specific Google Drive storage area.

## Google Drive Storage Strategy

Use Google Drive `appDataFolder` to store ResumeFlow data.

Files to create:

- resumeflow-resumes.json
- resumeflow-applications.json
- resumeflow-notes.json
- resumeflow-qna.json
- resumeflow-statusHistory.json
- resumeflow-documents.json

Profile photos shall be stored as separate image files in Google Drive appDataFolder.

Each photo record in resume JSON should store metadata:

- driveFileId
- fileName
- mimeType
- createdAt

Do not store large Base64 photos directly inside resume JSON once Google Drive storage is enabled.

## Data Flow

### Save Resume

When user saves a resume:

1. Check user session.
2. Get Google access token.
3. Read existing resumeflow-resumes.json from Google Drive appDataFolder.
4. Update the resume object.
5. Upload/update resumeflow-resumes.json in Google Drive.

### Load Resume

When user opens ResumeFlow:

1. Check user session.
2. Get Google access token.
3. Look for resumeflow-resumes.json in Google Drive appDataFolder.
4. If found, load data.
5. If not found, create file with empty array.

### Save Profile Photo

When user uploads profile photo:

1. Check user session.
2. Upload image file to Google Drive appDataFolder.
3. Save returned driveFileId in the resume record.
4. Render the photo using a secure API route that fetches the image with the user's access token.

## API Routes

Create Drive storage routes:

- /api/drive/resumes
- /api/drive/applications
- /api/drive/notes
- /api/drive/qna
- /api/drive/status-history
- /api/drive/documents
- /api/drive/photos/upload
- /api/drive/photos/[fileId]

## UI Changes

Update navigation:

- Show signed-in user name/email.
- Show Sign out button.
- Hide app pages when user is not signed in.
- Redirect unauthenticated users to `/signin`.

## Fallback Mode

For development, if Google Drive credentials are missing, show a clear error message.

Do not silently save cloud data to local JSON when user expects Google Drive storage.

## Security Notes

- Do not expose Google access token to client components.
- Drive read/write operations must happen in server routes.
- Do not store OAuth tokens inside JSON files.
- Do not commit `.env.local`.
