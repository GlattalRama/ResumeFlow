import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { authSecret } from "@/lib/googleConfig";
import { appleBundleId, appleClientId } from "@/lib/appleConfig";
import {
  SESSION_MAX_AGE,
  setSessionCookie,
} from "@/lib/sessionCookie";
import { trackLogin } from "@/lib/analytics/track";

// Native Sign in with Apple bridge. Inside the Capacitor shell the native
// Apple sheet (ASAuthorization) returns an identity token; the WebView JS
// POSTs it here and we mint the same encrypted NextAuth session JWT the web
// Apple flow produces — provider "apple", no Drive tokens (the Drive connect
// flow adds those separately).
//
// SECURITY: unlike /api/auth/mobile/google — where the tokens come straight
// from Google's token endpoint authenticated with our client secret — this
// identity token passed through the untrusted client. It MUST be verified
// against Apple's published keys, and its audience must be one of our own
// client ids (the iOS bundle id for the native sheet, the Services ID for a
// web-based fallback).
export const dynamic = "force-dynamic";

const APPLE_ISSUER = "https://appleid.apple.com";
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function POST(req: NextRequest) {
  const secret = authSecret();
  if (!secret) {
    return NextResponse.json({ error: "auth_secret_missing" }, { status: 500 });
  }

  let identityToken: unknown;
  let name: unknown;
  try {
    const body = await req.json();
    identityToken = body?.identityToken ?? body?.idToken;
    name = body?.name;
  } catch {
    // Invalid/absent JSON — handled by the guard below.
  }
  if (!identityToken || typeof identityToken !== "string") {
    return NextResponse.json({ error: "missing_identity_token" }, { status: 400 });
  }

  const audiences = [appleBundleId(), appleClientId()].filter(Boolean);
  let claims: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(identityToken, appleJwks, {
      issuer: APPLE_ISSUER,
      audience: audiences,
      maxTokenAge: "10m",
    });
    claims = payload as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_identity_token" }, { status: 401 });
  }

  const sub = (claims.sub as string) ?? null;
  if (!sub) {
    return NextResponse.json({ error: "no_identity" }, { status: 401 });
  }
  // Apple includes the (possibly private-relay) email claim in the identity
  // token. The name is only delivered natively on the FIRST authorization, so
  // the client forwards it when present.
  const email = (claims.email as string) ?? null;

  const jwtToken = {
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    email,
    picture: null,
    sub,
    provider: "apple",
  };
  const encoded = await encode({ token: jwtToken, secret, maxAge: SESSION_MAX_AGE });

  // Privacy-friendly login analytics, mirroring the web signIn callback.
  await trackLogin({
    userId: email ?? sub,
    country: req.headers.get("x-vercel-ip-country"),
  });

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, encoded);
  return res;
}
