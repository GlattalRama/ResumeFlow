// Server-only session helpers. The Google access token lives in the encrypted
// JWT cookie and is read here via getToken — it is NEVER placed on the session
// object that reaches client components.
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authOptions } from "./auth";
import { authSecret, useSecureCookies } from "./googleConfig";

export function getSession() {
  return getServerSession(authOptions);
}

// Read the current Google access token from the JWT. Returns null when the user
// is not signed in or when a token refresh has failed.
export async function getAccessToken(): Promise<string | null> {
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
  return (token.accessToken as string) ?? null;
}
