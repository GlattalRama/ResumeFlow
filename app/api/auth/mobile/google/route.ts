import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import {
  authSecret,
  useSecureCookies,
  hasGoogleCredentials,
} from "@/lib/googleConfig";
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

// Match NextAuth's default session lifetime (30 days) so the minted cookie
// behaves identically to a browser sign-in.
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function sessionCookieName(): string {
  return useSecureCookies()
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

// Decode a JWT payload without signature verification. Safe here: this id_token
// came straight from Google's token endpoint over TLS, authenticated with our
// own client secret — it was never handled by the untrusted client.
function decodeIdToken(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1] ?? "";
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

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
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: serverAuthCode,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      redirect_uri: "",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) {
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 401 });
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
    accessToken: tokens.access_token as string,
    refreshToken: (tokens.refresh_token as string) ?? undefined,
    expiresAt: tokens.expires_in
      ? now + (tokens.expires_in as number)
      : undefined,
  };

  const encoded = await encode({ token: jwtToken, secret, maxAge: SESSION_MAX_AGE });

  // Privacy-friendly login analytics, mirroring the web signIn callback.
  await trackLogin({ userId: email, country: req.headers.get("x-vercel-ip-country") });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(), encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies(),
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
