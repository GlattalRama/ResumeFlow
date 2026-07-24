// Server-only helpers shared by the routes that mint or amend the NextAuth
// session cookie outside of NextAuth itself: the native sign-in bridges
// (/api/auth/mobile/*) and the Google Drive connect flow (/api/drive/*).
import type { NextRequest, NextResponse } from "next/server";
import { useSecureCookies, DRIVE_SCOPE } from "./googleConfig";

// CSRF state cookie for the web Drive connect flow.
export const DRIVE_STATE_COOKIE = "rf_drive_state";

// The site origin OAuth redirects return to: the canonical NEXTAUTH_URL in
// real deployments, the request origin in local dev.
export function oauthBaseUrl(req: NextRequest): string {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  return req.nextUrl.origin;
}

// Match NextAuth's default session lifetime (30 days) so minted cookies behave
// identically to a browser sign-in.
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export function sessionCookieName(): string {
  return useSecureCookies()
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export function setSessionCookie(res: NextResponse, encoded: string): void {
  res.cookies.set(sessionCookieName(), encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies(),
    maxAge: SESSION_MAX_AGE,
  });
}

// Decode a JWT payload without signature verification. Only safe for tokens
// that came straight from the issuer's token endpoint over TLS, authenticated
// with our own client secret — never for tokens handled by an untrusted client.
export function decodeIdToken(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1] ?? "";
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

export type GoogleTokens = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
};

// Exchange an authorization code at Google's token endpoint using the web
// OAuth client. redirect_uri is "" for codes minted by the native Google
// Sign-In SDKs (the "server auth code" offline flow) and the real callback URL
// for codes from a browser redirect flow.
export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string
): Promise<{ ok: boolean; tokens: GoogleTokens }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokens = (await res.json()) as GoogleTokens;
  return { ok: res.ok && !!tokens.access_token, tokens };
}

// Google's consent screen presents drive.appdata as an optional checkbox; a
// user who unchecks it still completes the flow, but every Drive call would
// then fail. Callers must refuse to proceed without it.
export function hasDriveScope(tokens: GoogleTokens): boolean {
  return (tokens.scope ?? "").includes(DRIVE_SCOPE);
}
