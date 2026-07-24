import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getToken } from "next-auth/jwt";
import {
  authSecret,
  useSecureCookies,
  hasGoogleCredentials,
  DRIVE_SCOPE,
} from "@/lib/googleConfig";
import { DRIVE_STATE_COOKIE, oauthBaseUrl } from "@/lib/sessionCookie";

// Starts the Google Drive CONNECT flow for a signed-in user whose login did
// not grant Drive (Sign in with Apple). This is authorization only — the user
// stays signed in with their existing identity; we just ask Google for the
// drive.appdata scope (plus openid+email so the UI can show which Google
// account the Drive belongs to). The callback merges the tokens into the
// existing session JWT — nothing is stored server-side.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!hasGoogleCredentials()) {
    return NextResponse.json({ error: "google_not_configured" }, { status: 503 });
  }

  const token = await getToken({
    req,
    secret: authSecret(),
    secureCookie: useSecureCookies(),
  });
  if (!token) {
    return NextResponse.redirect(new URL("/signin", oauthBaseUrl(req)));
  }

  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl");
  const cb = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${oauthBaseUrl(req)}/api/drive/callback`,
    response_type: "code",
    scope: `openid email ${DRIVE_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  // CSRF state + return path for the callback. Lax is enough: the return from
  // accounts.google.com is a top-level GET navigation.
  res.cookies.set(DRIVE_STATE_COOKIE, JSON.stringify({ state, cb }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies(),
    maxAge: 600,
  });
  return res;
}
