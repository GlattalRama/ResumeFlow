// Edge-safe Google configuration helpers.
// This module must stay free of heavy/server-only imports (no next-auth,
// no googleapis, no next/headers) so it can be imported from middleware.

import type { CollectionName } from "./types";

// Google Drive scope that lets ResumeFlow read/write its own app-specific data
// in the user's Drive (the hidden appDataFolder).
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

// OAuth scopes requested at sign-in: basic profile, email, and Drive app data.
export const GOOGLE_SCOPES = `openid email profile ${DRIVE_SCOPE}`;

// Drive appDataFolder file name for each ResumeFlow collection.
const DRIVE_FILE_NAMES: Record<CollectionName, string> = {
  resumes: "resumeflow-resumes.json",
  applications: "resumeflow-applications.json",
  notes: "resumeflow-notes.json",
  qna: "resumeflow-qna.json",
  statusHistory: "resumeflow-statusHistory.json",
  documents: "resumeflow-documents.json",
  settings: "resumeflow-settings.json",
  resumeSnapshots: "resumeflow-resumeSnapshots.json",
  workJournal: "resumeflow-workJournal.json",
};

export function driveFileName(name: CollectionName): string {
  return DRIVE_FILE_NAMES[name];
}

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.startsWith("replace_with");
}

// True only when real (non-placeholder) Google OAuth credentials are present.
// When false, ResumeFlow runs in local-JSON development mode: authentication is
// not enforced and data is stored in /data instead of Google Drive.
export function hasGoogleCredentials(): boolean {
  return (
    !isPlaceholder(process.env.GOOGLE_CLIENT_ID) &&
    !isPlaceholder(process.env.GOOGLE_CLIENT_SECRET)
  );
}

export function authSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

// Cookies are secured (and named __Secure-…) when the deployment URL is https.
export function useSecureCookies(): boolean {
  return (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}
