# Deploying ResumeFlow to Vercel (free tier)

ResumeFlow is a server-rendered Next.js app (API routes, NextAuth + Google
OAuth, Google Drive storage). Vercel's free **Hobby** tier runs all of this at
no cost. These steps deploy to the free `*.vercel.app` URL (no custom domain).

## 1. Push your code to GitHub

Already done — the repo lives at `GlattalRama/ResumeFlow` and `main` is current.
Your secrets are safe: `.env*.local` is gitignored, so only code is on GitHub.

## 2. Create the Vercel project

1. Go to <https://vercel.com> and **Sign up / Log in with GitHub**.
2. Click **Add New… → Project**.
3. **Import** the `ResumeFlow` repository (authorize Vercel to access it if asked).
4. Framework is auto-detected as **Next.js**. Leave build settings at defaults
   (build `next build`, output handled automatically).
5. **Before** clicking Deploy, add the environment variables in step 3.

## 3. Environment variables

In the import screen (or later under **Project → Settings → Environment
Variables**), add these for the **Production** environment:

| Name | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | from Google Cloud console (same as local) |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud console (same as local) |
| `AUTH_SECRET` | a random secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<your-project>.vercel.app` (set after first deploy — see step 5) |

Notes:
- `AUTH_SECRET` can be the same value as your local `.env.local`, or a new one.
- `NEXTAUTH_URL` must be the **https** Vercel URL — the app enables secure
  cookies only when this starts with `https://`.

## 4. First deploy

Click **Deploy**. Vercel builds and assigns a URL like
`https://resumeflow-xxxx.vercel.app`. Copy that URL.

## 5. Wire up the URL + Google OAuth

1. Set `NEXTAUTH_URL` (Settings → Environment Variables) to the exact deployed
   URL, e.g. `https://resumeflow-xxxx.vercel.app`.
2. In the **Google Cloud console** → APIs & Services → Credentials → your OAuth
   client, add:
   - **Authorized JavaScript origins:** `https://resumeflow-xxxx.vercel.app`
   - **Authorized redirect URI:**
     `https://resumeflow-xxxx.vercel.app/api/auth/callback/google`
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new `NEXTAUTH_URL` takes
   effect.

## 6. Verify

- Visit the Vercel URL → you should be redirected to `/signin`.
- Sign in with Google → you land on the dashboard.
- Data is stored per-user in that user's Google Drive `appDataFolder`
  (nothing is written to the server filesystem in production).

## Auto-deploys

Every push to `main` triggers a new production deploy automatically. Pull
requests get their own preview URLs.

## Costs

- Hosting: **$0** on the Hobby tier (personal, non-commercial use).
- Google OAuth / Drive API: free at personal usage levels.
- No custom domain = no domain cost.
