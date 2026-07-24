// Edge-safe Sign in with Apple configuration helpers.
// Like lib/googleConfig.ts, this module must stay free of heavy/server-only
// imports so it can be imported from middleware and client-adjacent code.

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.startsWith("replace_with");
}

// OAuth client_id for Sign in with Apple on the WEB — this is a Services ID
// (e.g. com.resumeflowats.app.web) registered in the Apple Developer portal
// with the site's domain and return URL. It is NOT the iOS bundle id.
export function appleClientId(): string {
  return process.env.APPLE_CLIENT_ID ?? "";
}

// The iOS app's bundle id — the audience ("aud") of identity tokens minted by
// the native Sign in with Apple sheet inside the Capacitor shell.
export function appleBundleId(): string {
  return process.env.APPLE_BUNDLE_ID ?? "com.resumeflowats.app";
}

// True only when the full Sign in with Apple web configuration is present:
// Services ID, Team ID, and the Sign in with Apple key (id + .p8 contents).
// When false, the Apple sign-in option is simply not offered.
export function hasAppleCredentials(): boolean {
  return (
    !isPlaceholder(process.env.APPLE_CLIENT_ID) &&
    !isPlaceholder(process.env.APPLE_TEAM_ID) &&
    !isPlaceholder(process.env.APPLE_KEY_ID) &&
    !isPlaceholder(process.env.APPLE_PRIVATE_KEY)
  );
}
