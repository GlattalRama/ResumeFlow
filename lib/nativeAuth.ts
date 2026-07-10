"use client";

// Native (Capacitor) Google sign-in bridge.
//
// In a normal web browser `isNativePlatform()` is false and none of this runs —
// the app uses the standard NextAuth redirect flow. Inside the Capacitor shell,
// Google blocks OAuth in the WebView, so we sign in through the native Google
// plugin and hand the returned one-time server auth code to
// /api/auth/mobile/google, which mints the same NextAuth session cookie.
//
// This module deliberately talks to the plugin through the injected
// `window.Capacitor` bridge instead of importing the plugin package, so the web
// build has NO dependency on the native plugin being installed. The plugin is
// added to the app in the Android/iOS project only (see docs/mobile-setup.md).

/* eslint-disable @typescript-eslint/no-explicit-any */

type Capacitorish = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, any>;
};

function cap(): Capacitorish | undefined {
  if (typeof globalThis === "undefined") return undefined;
  return (globalThis as any).Capacitor as Capacitorish | undefined;
}

// True only inside the Capacitor Android/iOS shell.
export function isNativePlatform(): boolean {
  return cap()?.isNativePlatform?.() === true;
}

// The Google scopes the app needs — must match the web flow (lib/googleConfig).
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.appdata",
];

let initialized = false;

// Initialize @capgo/capacitor-social-login once, in `offline` mode so Google
// returns a server auth code (redeemable by our web client's secret) plus a
// refresh token. The webClientId is the public web OAuth client ID. iOS also
// needs its own iOS OAuth client ID (the GoogleSignIn SDK requires it) with
// the web client as iOSServerClientId so the auth code stays redeemable by
// our server — see docs/mobile-setup.md.
async function ensureInitialized(plugin: any): Promise<void> {
  if (initialized) return;
  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!webClientId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.");
  }
  const iOSClientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (cap()?.getPlatform?.() === "ios" && !iOSClientId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set.");
  }
  await plugin.initialize({
    google: {
      webClientId,
      mode: "offline",
      ...(iOSClientId
        ? { iOSClientId, iOSServerClientId: webClientId }
        : {}),
    },
  });
  initialized = true;
}

// Runs native Google sign-in, then establishes the web session by posting the
// server auth code to the mobile endpoint. Resolves once the session cookie is
// set; the caller then navigates into the app. Throws with a readable message
// on any failure so the sign-in button can surface it.
export async function nativeGoogleSignIn(): Promise<void> {
  // @capgo/capacitor-social-login registers as `SocialLogin`.
  const plugin = cap()?.Plugins?.SocialLogin;
  if (!plugin) {
    throw new Error(
      "Native Google sign-in is unavailable in this build. Update the app."
    );
  }

  await ensureInitialized(plugin);

  const result = await plugin.login({
    provider: "google",
    // Ask for a server auth code + offline refresh so the server can obtain a
    // refresh token and Drive access, matching the web flow's scopes/offline.
    options: { scopes: GOOGLE_SCOPES, forceRefreshToken: true },
  });

  // Different plugin versions nest the code differently — accept the known shapes.
  const serverAuthCode: string | undefined =
    result?.result?.serverAuthCode ??
    result?.serverAuthCode ??
    result?.result?.authorizationCode ??
    result?.authorizationCode;

  if (!serverAuthCode) {
    throw new Error("Google sign-in did not return an authorization code.");
  }

  const res = await fetch("/api/auth/mobile/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverAuthCode }),
  });
  if (!res.ok) {
    throw new Error(`Could not establish a session (${res.status}).`);
  }
}
