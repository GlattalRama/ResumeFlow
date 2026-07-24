import { cookies, headers } from "next/headers";

// The Android app is a Capacitor WebView pointed at the live site
// (android/app/src/main/assets/capacitor.config.json → server.url), so
// "native" is a per-request property of the same Next.js app, not a separate
// build. A request counts as native when any of these match:
//
//  - "ResumeflowApp" UA token — appended by the Capacitor shell via
//    appendUserAgent in capacitor.config.json (definitive, but only present
//    in APKs built after the token was added).
//  - "; wv)" UA marker — the Android system-WebView signature; covers APKs
//    that predate the token. Also matches other apps' in-app WebViews, which
//    is an acceptable trade-off: those visitors get the mobile shell.
//  - rf_native cookie — set by visiting any page with ?native=1 (cleared with
//    ?native=0, see middleware.ts) so the shell can be previewed in a normal
//    desktop browser.
const NATIVE_UA = /ResumeflowApp|; wv\)/;

export async function isNativeAppRequest(): Promise<boolean> {
  const flag = (await cookies()).get("rf_native")?.value;
  if (flag === "1" || flag === "ios") return true;
  const ua = (await headers()).get("user-agent") ?? "";
  return NATIVE_UA.test(ua);
}

// True only inside the iOS shell (App Store rules differ from Play's: e.g. the
// BYOK "add your own OpenRouter key" option is hidden there — guideline 3.1.1
// reads externally-billed services as out-of-app purchases). Detected via the
// appended UA token + an Apple device marker, or the rf_native=ios preview
// cookie (?native=ios in a desktop browser, cleared with ?native=0).
export async function isNativeIOSRequest(): Promise<boolean> {
  const flag = (await cookies()).get("rf_native")?.value;
  if (flag === "ios") return true;
  const ua = (await headers()).get("user-agent") ?? "";
  return ua.includes("ResumeflowApp") && /iPhone|iPad|iPod/.test(ua);
}
