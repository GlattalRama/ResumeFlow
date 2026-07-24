import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { authSecret, hasGoogleCredentials } from "@/lib/googleConfig";
import {
  SESSION_MAX_AGE,
  setSessionCookie,
  decodeIdToken,
  exchangeGoogleAuthCode,
  hasDriveScope,
} from "@/lib/sessionCookie";
import { trackLogin } from "@/lib/analytics/track";

// Mobile sign-in bridge. Google refuses OAuth inside the Capacitor WebView
// (disallowed_useragent), so the native shell signs in with the native Google
// plugin and POSTs the resulting one-time server auth code here. We exchange it
// for tokens and mint the EXACT same encrypted JWT the NextAuth `jwt` callback
// produces on a web sign-in — so middleware, getToken and getAccessToken all
// read this session unchanged. Because the WebView's own JS makes this request,
// the Set-Cookie lands in the WebView's cookie store and the app is signed in.
//
// This lives at /api/auth/mobile/google (a more specific segment than the
// [...nextauth] catch-all, so Next routes here) and is exempt from the auth
// guard via middleware's `api/auth` matcher exclusion.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!hasGoogleCredentials()) {
    return NextResponse.json({ error: "google_not_configured" }, { status: 503 });
  }
  const secret = authSecret();
  if (!secret) {
    return NextResponse.json({ error: "auth_secret_missing" }, { status: 500 });
  }

  let serverAuthCode: unknown;
  try {
    const body = await req.json();
    serverAuthCode = body?.serverAuthCode ?? body?.code;
  } catch {
    // Invalid/absent JSON — handled by the guard below.
  }
  if (!serverAuthCode || typeof serverAuthCode !== "string") {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  // Exchange the one-time server auth code for tokens using the SAME web OAuth
  // client the browser flow uses. redirect_uri is empty for codes minted by the
  // native Google Sign-In SDKs (the "server auth code" offline flow).
  const { ok, tokens } = await exchangeGoogleAuthCode(serverAuthCode, "");
  if (!ok) {
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 401 });
  }

  // A user who unchecks the optional Drive checkbox still completes sign-in,
  // but every Drive call would then fail and dump them on the error page.
  // Refuse to mint such a session so the client can explain and re-run consent.
  if (!hasDriveScope(tokens)) {
    return NextResponse.json({ error: "drive_scope_missing" }, { status: 403 });
  }

  // Identity comes from the id_token Google returned alongside the tokens.
  let claims: Record<string, unknown> = {};
  try {
    if (tokens.id_token) claims = decodeIdToken(tokens.id_token as string);
  } catch {
    // Malformed/absent id_token — the identity guard below rejects it.
  }
  const email = (claims.email as string) ?? null;
  const sub = (claims.sub as string) ?? null;
  if (!email || !sub) {
    return NextResponse.json({ error: "no_identity" }, { status: 401 });
  }

  // Build the exact token shape the NextAuth `jwt` callback returns on the
  // initial web sign-in (see lib/auth.ts): profile fields + the OAuth tokens.
  const now = Math.floor(Date.now() / 1000);
  const jwtToken = {
    name: (claims.name as string) ?? null,
    email,
    picture: (claims.picture as string) ?? null,
    sub,
    provider: "google",
    accessToken: tokens.access_token as string,
    refreshToken: tokens.refresh_token ?? undefined,
    expiresAt: tokens.expires_in ? now + tokens.expires_in : undefined,
  };

  const encoded = await encode({ token: jwtToken, secret, maxAge: SESSION_MAX_AGE });

  // Privacy-friendly login analytics, mirroring the web signIn callback.
  await trackLogin({ userId: email, country: req.headers.get("x-vercel-ip-country") });

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, encoded);
  return res;
}
