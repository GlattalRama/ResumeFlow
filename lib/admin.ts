// Admin authorization.
//
// MVP admin access is controlled by the ADMIN_EMAILS env var (comma-separated).
// No role is stored anywhere. Authorization FAILS CLOSED: with ADMIN_EMAILS
// empty/unset, no signed-in user is an admin.
//
// Local dev exception: when Google OAuth is NOT configured the app runs in
// local-JSON mode with auth disabled (see lib/store.ts). In that mode there is
// no session to check, so the local developer is treated as admin — consistent
// with the rest of the app being open in dev.

import type { Session } from "next-auth";
import { hasGoogleCredentials } from "./googleConfig";

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.toLowerCase());
}

export function isAdminSession(session: Session | null): boolean {
  // Local dev (no real OAuth): auth isn't enforced, so the dashboard is open.
  if (!hasGoogleCredentials()) return true;
  return isAdminEmail(session?.user?.email ?? null);
}
