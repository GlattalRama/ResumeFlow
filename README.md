# ResumeFlow

Resume builder and job application tracker built with Next.js (App Router),
TypeScript, and Tailwind CSS.

Signed-in users authenticate with Google and their data (resumes, applications,
notes, Q&A, status history, documents, and profile photos) is stored in their
own Google Drive **appDataFolder** — a hidden, app-private storage area. When
Google credentials are not configured, the app runs in **local development
mode** and stores data as JSON files under `/data`.

## Requirements

- Node.js 18.18+ (Node 20+ recommended)
- A Google account (for the Drive-backed mode)

## Quick start (local development mode)

You can run the app immediately without any Google setup. It will store data in
`/data` and skip authentication.

```bash
npm install
cp .env.local.example .env.local   # leave the GOOGLE_* placeholders as-is
npm run dev
# open http://localhost:3000
```

In this mode, `/signin` shows a "local development mode" notice and a
**Continue in local mode** link.

## Enabling Google sign-in + Google Drive storage

> **This is a one-time setup performed by the app developer/operator, not by
> end users.** You configure a single OAuth client (`GOOGLE_CLIENT_ID` /
> `GOOGLE_CLIENT_SECRET`) once. After that, **any** Google user can sign in with
> their own account by clicking **Sign in with Google** — they never touch the
> Google Cloud Console and nothing is configured per user. Each signed-in user's
> data is stored in *their own* Google Drive `appDataFolder`; the app never
> creates Google accounts.

### 1. Create Google Cloud OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   create (or select) a project.
2. **Enable the Google Drive API**: *APIs & Services → Library →* search
   "Google Drive API" → **Enable**.
3. **Configure the OAuth consent screen**: *APIs & Services → OAuth consent
   screen*.
   - User type: **External** (or Internal for a Workspace org).
   - Fill in app name, support email, and developer contact.
   - **Scopes**: add `.../auth/userinfo.email`, `.../auth/userinfo.profile`,
     `openid`, and `https://www.googleapis.com/auth/drive.appdata`.
   - While the app is in **Testing**, only Google accounts listed under
     **Test users** can sign in — add the accounts you want to allow.
   - **To let _any_ Google user sign in, publish the consent screen**
     (*Publishing status → Publish app*). The `drive.appdata` scope is
     non-sensitive, so no Google verification review is required for general
     availability.
4. **Create the OAuth client**: *APIs & Services → Credentials → Create
   Credentials → OAuth client ID*.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:3000`
     (add your production origin too, e.g. `https://yourdomain.com`).
   - **Authorized redirect URIs**:
     `http://localhost:3000/api/auth/callback/google`
     (and `https://yourdomain.com/api/auth/callback/google` for production).
   - Copy the generated **Client ID** and **Client secret**.

> The `drive.appdata` scope only grants access to ResumeFlow's own hidden app
> data folder — it cannot read or modify the rest of the user's Drive.

### 2. Configure environment variables

Copy the example file and fill in real values:

```bash
cp .env.local.example .env.local
```

```dotenv
# Generate with: openssl rand -base64 32
AUTH_SECRET=your_generated_secret

# Dev: http://localhost:3000   Prod: your public https URL
NEXTAUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

`AUTH_SECRET` is read as `AUTH_SECRET` or, if absent, `NEXTAUTH_SECRET`.

### 3. Run

```bash
npm run dev          # http://localhost:3000
# or for a production build:
npm run build && npm start
```

Open the app — unauthenticated requests are redirected to `/signin`. Click
**Sign in with Google**, grant the requested scopes, and you'll land on the
dashboard. Your data now reads/writes from Google Drive.

## How it works

| Concern | Where |
| --- | --- |
| OAuth config, scopes, token refresh | `lib/auth.ts`, `lib/googleConfig.ts` |
| NextAuth route | `app/api/auth/[...nextauth]/route.ts` |
| Server-only access-token read | `lib/serverSession.ts` (`getAccessToken`) |
| Route protection | `middleware.ts` |
| Drive primitives (find/read/write/upload/get) | `lib/googleDriveStore.ts` |
| Storage backend selection (Drive vs local JSON) | `lib/store.ts` |
| Photo upload / fetch | `app/api/drive/photos/*` |
| Sign-in UI / sign-out | `app/signin/page.tsx`, `components/Nav.tsx` |

### Drive files

JSON collections are stored one file each in appDataFolder:

```
resumeflow-resumes.json
resumeflow-applications.json
resumeflow-notes.json
resumeflow-qna.json
resumeflow-statusHistory.json
resumeflow-documents.json
```

Profile photos are stored as separate image files; the resume JSON keeps only
metadata (`driveFileId`, `fileName`, `mimeType`, `createdAt`) — never the image
bytes.

### Security notes

- The Google access/refresh tokens live only in the encrypted session JWT cookie
  and are read **server-side** (`getAccessToken`). They are never placed on the
  session object sent to the browser or exposed to client components.
- All Drive reads/writes happen in server routes / server components.
- Profile photos are served through `app/api/drive/photos/[fileId]`, which holds
  the token server-side and streams the image bytes to the client.
- `.env.local` is gitignored — don't commit credentials.
