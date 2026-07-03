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

  const result = await plugin.login({
    provider: "google",
    // Ask for a server auth code + offline refresh so the server can obtain a
    // refresh token and Drive access, matching the web flow's scopes/offline.
    options: { forceRefreshToken: true },
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
