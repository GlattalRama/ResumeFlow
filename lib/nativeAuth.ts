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

// True only inside the Capacitor iOS shell (Sign in with Apple is offered
// natively on iOS + on the web, but not in the Android shell).
export function isNativeIOS(): boolean {
  return isNativePlatform() && cap()?.getPlatform?.() === "ios";
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
    // Sign in with Apple uses the native ASAuthorization sheet on iOS; the
    // plugin only activates its Apple provider when an `apple` block is
    // present. Empty redirectUrl = no web redirect (per plugin docs).
    ...(cap()?.getPlatform?.() === "ios" ? { apple: { redirectUrl: "" } } : {}),
  });
  initialized = true;
}

// Returns the SocialLogin plugin or throws a readable error.
function socialLoginPlugin(): any {
  // @capgo/capacitor-social-login registers as `SocialLogin`.
  const plugin = cap()?.Plugins?.SocialLogin;
  if (!plugin) {
    throw new Error(
      "Native sign-in is unavailable in this build. Update the app."
    );
  }
  return plugin;
}

// Runs the native Google auth sheet and returns the one-time server auth code.
async function nativeGoogleAuthCode(): Promise<string> {
  const plugin = socialLoginPlugin();
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
  return serverAuthCode;
}

async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    return (await res.json())?.error;
  } catch {
    return undefined;
  }
}

const DRIVE_SCOPE_MESSAGE =
  "Google Drive access wasn't granted. Your resumes are stored in your " +
  "own Google Drive, so the app can't work without it. Please try " +
  "again and keep the Google Drive option checked.";

// Runs native Google sign-in, then establishes the web session by posting the
// server auth code to the mobile endpoint. Resolves once the session cookie is
// set; the caller then navigates into the app. Throws with a readable message
// on any failure so the sign-in button can surface it.
export async function nativeGoogleSignIn(): Promise<void> {
  const serverAuthCode = await nativeGoogleAuthCode();

  const res = await fetch("/api/auth/mobile/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverAuthCode }),
  });
  if (!res.ok) {
    if ((await readErrorCode(res)) === "drive_scope_missing") {
      throw new Error(DRIVE_SCOPE_MESSAGE);
    }
    throw new Error(`Could not establish a session (${res.status}).`);
  }
}

// Runs the native Sign in with Apple sheet (iOS only), then establishes the
// web session by posting the identity token to the mobile endpoint. The
// session it mints has no Google Drive tokens — the app routes the user to
// /connect-drive next.
export async function nativeAppleSignIn(): Promise<void> {
  const plugin = socialLoginPlugin();
  await ensureInitialized(plugin);

  const result = await plugin.login({
    provider: "apple",
    options: { scopes: ["email", "name"] },
  });

  // Accept the known result shapes across plugin versions.
  const r = result?.result ?? result ?? {};
  const identityToken: string | undefined =
    r.idToken ?? r.identityToken ?? r.accessToken?.token;
  if (!identityToken) {
    throw new Error("Apple sign-in did not return an identity token.");
  }

  // Apple only delivers the name on the FIRST authorization — forward it so
  // the account isn't nameless.
  const profile = r.profile ?? {};
  const name =
    [profile.givenName, profile.familyName].filter(Boolean).join(" ").trim() ||
    undefined;

  const res = await fetch("/api/auth/mobile/apple", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityToken, name }),
  });
  if (!res.ok) {
    throw new Error(`Could not establish a session (${res.status}).`);
  }
}

// For a signed-in (Apple) session without Drive: runs the native Google auth
// sheet with the Drive scope and merges the resulting tokens into the existing
// session via the mobile connect endpoint. Identity is unchanged.
export async function nativeConnectDrive(): Promise<void> {
  const serverAuthCode = await nativeGoogleAuthCode();

  const res = await fetch("/api/drive/mobile/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverAuthCode }),
  });
  if (!res.ok) {
    if ((await readErrorCode(res)) === "drive_scope_missing") {
      throw new Error(DRIVE_SCOPE_MESSAGE);
    }
    throw new Error(`Could not connect Google Drive (${res.status}).`);
  }
}
