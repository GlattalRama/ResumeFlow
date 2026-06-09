// Server-only session helpers. The Google access token lives in the encrypted
// JWT cookie and is read here via getToken — it is NEVER placed on the session
// object that reaches client components.
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { cache } from "react";
import { authOptions, refreshAccessToken } from "./auth";
import { authSecret, useSecureCookies } from "./googleConfig";

export function getSession() {
  return getServerSession(authOptions);
}

// Read the current Google access token from the JWT. Returns null when the user
// is not signed in or when a token refresh has failed.
//
// Wrapped in React.cache so the (potential) refresh runs at most once per
// request — a page like the dashboard reads several collections in parallel,
// each of which would otherwise call this and fire its own refresh.
export const getAccessToken = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();

  const token = await getToken({
    // next-auth's getToken reads cookies from `req.cookies` (via SessionStore),
    // NOT from `req.headers.cookie`. Pass the Next.js cookie store directly — it
    // exposes the `.getAll()` shape SessionStore expects and correctly handles
    // chunked session cookies (next-auth.session-token.0/.1/…).
    req: { cookies: cookieStore } as never,
    secret: authSecret(),
    secureCookie: useSecureCookies(),
  });

  if (!token || token.error) return null;

  // getToken() only DECODES the cookie — unlike getServerSession it does NOT run
  // the NextAuth `jwt` callback, so a token that expired while the tab sat idle
  // is returned as-is and then rejected live by the Google Drive API. Refresh it
  // inline here when it's expired (or within the 60s safety margin) so storage
  // never hands out a stale token. We can't rewrite the cookie during a render,
  // so this covers the current request; the client session poll / next NextAuth
  // handler hit re-persists the refreshed token to the cookie.
  const expiresAt = token.expiresAt as number | undefined;
  const expired = !!expiresAt && Date.now() >= expiresAt * 1000 - 60_000;

  if (expired) {
    if (!token.refreshToken) return null;
    const refreshed = (await refreshAccessToken(
      token as Record<string, unknown>
    )) as Record<string, unknown>;
    if (refreshed.error) return null;
    return (refreshed.accessToken as string) ?? null;
  }

  return (token.accessToken as string) ?? null;
});
