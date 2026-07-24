import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { encode } from "next-auth/jwt";
import {
  authSecret,
  useSecureCookies,
  hasGoogleCredentials,
} from "@/lib/googleConfig";
import {
  SESSION_MAX_AGE,
  setSessionCookie,
  decodeIdToken,
  exchangeGoogleAuthCode,
  hasDriveScope,
  DRIVE_STATE_COOKIE,
  oauthBaseUrl,
} from "@/lib/sessionCookie";

// Completes the Google Drive connect flow: verifies the CSRF state, exchanges
// the code, and merges the Drive tokens into the user's EXISTING session JWT.
// The user's login identity (e.g. their Apple sub/email) is unchanged — only
// accessToken/refreshToken/expiresAt/driveEmail are added, exactly the fields
// middleware and getAccessToken already understand.
export const dynamic = "force-dynamic";

function connectError(req: NextRequest, code: string): NextResponse {
  const res = NextResponse.redirect(
    new URL(`/connect-drive?error=${code}`, oauthBaseUrl(req))
  );
  res.cookies.delete(DRIVE_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  if (!hasGoogleCredentials()) {
    return NextResponse.json({ error: "google_not_configured" }, { status: 503 });
  }
  const secret = authSecret();
  if (!secret) {
    return NextResponse.json({ error: "auth_secret_missing" }, { status: 500 });
  }

  // User declined on Google's screen.
  if (req.nextUrl.searchParams.get("error")) {
    return connectError(req, "denied");
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  let stored: { state?: string; cb?: string } = {};
  try {
    stored = JSON.parse(req.cookies.get(DRIVE_STATE_COOKIE)?.value ?? "{}");
  } catch {
    // Malformed cookie — treated as missing state below.
  }
  if (!code || !state || !stored.state || state !== stored.state) {
    return connectError(req, "state_mismatch");
  }

  const token = await getToken({
    req,
    secret,
    secureCookie: useSecureCookies(),
  });
  if (!token) {
    const res = NextResponse.redirect(new URL("/signin", oauthBaseUrl(req)));
    res.cookies.delete(DRIVE_STATE_COOKIE);
    return res;
  }

  const { ok, tokens } = await exchangeGoogleAuthCode(
    code,
    `${oauthBaseUrl(req)}/api/drive/callback`
  );
  if (!ok) return connectError(req, "exchange_failed");
  if (!hasDriveScope(tokens)) return connectError(req, "scope_missing");

  // Which Google account the Drive belongs to — display only.
  let driveEmail: string | undefined;
  try {
    if (tokens.id_token) {
      driveEmail = decodeIdToken(tokens.id_token).email as string | undefined;
    }
  } catch {
    // Missing/malformed id_token — connection still works without the label.
  }

  const now = Math.floor(Date.now() / 1000);
  const merged = {
    ...token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? token.refreshToken,
    expiresAt: tokens.expires_in ? now + tokens.expires_in : undefined,
    driveEmail,
    error: undefined,
  };
  const encoded = await encode({ token: merged, secret, maxAge: SESSION_MAX_AGE });

  const cb = stored.cb && stored.cb.startsWith("/") ? stored.cb : "/";
  const res = NextResponse.redirect(new URL(cb, oauthBaseUrl(req)));
  res.cookies.delete(DRIVE_STATE_COOKIE);
  setSessionCookie(res, encoded);
  return res;
}
