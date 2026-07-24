import { NextRequest, NextResponse } from "next/server";
import { getToken, encode } from "next-auth/jwt";
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
} from "@/lib/sessionCookie";

// Native counterpart of the Drive connect flow. Google blocks OAuth inside the
// Capacitor WebView, so the shell runs the native Google plugin (Drive scope
// included) and POSTs the one-time server auth code here. Unlike
// /api/auth/mobile/google this does NOT create a session — it requires an
// existing (Apple) session and merges the Drive tokens into its JWT.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!hasGoogleCredentials()) {
    return NextResponse.json({ error: "google_not_configured" }, { status: 503 });
  }
  const secret = authSecret();
  if (!secret) {
    return NextResponse.json({ error: "auth_secret_missing" }, { status: 500 });
  }

  const token = await getToken({
    req,
    secret,
    secureCookie: useSecureCookies(),
  });
  if (!token) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
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

  const { ok, tokens } = await exchangeGoogleAuthCode(serverAuthCode, "");
  if (!ok) {
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 401 });
  }
  if (!hasDriveScope(tokens)) {
    return NextResponse.json({ error: "drive_scope_missing" }, { status: 403 });
  }

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

  const res = NextResponse.json({ ok: true, driveEmail: driveEmail ?? null });
  setSessionCookie(res, encoded);
  return res;
}
