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
  if (flag === "1") return true;
  const ua = (await headers()).get("user-agent") ?? "";
  return NATIVE_UA.test(ua);
}
