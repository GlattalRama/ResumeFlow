import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authSecret, useSecureCookies } from "@/lib/googleConfig";

// Protect ResumeFlow pages: unauthenticated users are redirected to /signin.
//
// When real Google credentials are NOT configured the app runs in local
// development mode — authentication is not enforced and every page is open.
export async function middleware(req: NextRequest) {
  // Canonical-domain redirect: force the apex custom domain in production.
  // Vercel's domain settings handle the alias-domain redirects natively
  // (resumeflowats.com and the old kiwi-cv.com → resumeflow-ats.com), so this
  // only needs to catch the raw *.vercel.app deployment URL and any www
  // subdomain as a backstop. Gated on VERCEL_ENV === "production" so preview
  // deployments keep their own *.vercel.app URLs and local dev is unaffected.
  // Runs before the auth check so visitors land on the apex domain's sign-in —
  // OAuth callbacks target resumeflow-ats.com via NEXTAUTH_URL, and Google
  // rejects any other host with redirect_uri_mismatch.
  const host = req.headers.get("host") ?? "";
  const isVercelHost = host.endsWith(".vercel.app");
  const isWwwHost = host.startsWith("www.");
  if (process.env.VERCEL_ENV === "production" && (isVercelHost || isWwwHost)) {
    const url = req.nextUrl.clone();
    url.protocol = "https";
    url.host = "resumeflow-ats.com";
    return NextResponse.redirect(url, 308);
  }

  // Native-shell preview override: ?native=1 persists the rf_native cookie
  // (read by lib/nativeApp.ts) and ?native=0 clears it, then reloads the page
  // without the param. Lets the Android app layout be checked in a desktop
  // browser without spoofing a WebView user agent.
  const nativeParam = req.nextUrl.searchParams.get("native");
  if (nativeParam === "1" || nativeParam === "0") {
    const url = req.nextUrl.clone();
    url.searchParams.delete("native");
    const res = NextResponse.redirect(url);
    if (nativeParam === "1") {
      res.cookies.set("rf_native", "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    } else {
      res.cookies.delete("rf_native");
    }
    return res;
  }

  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const credsConfigured =
    !!id &&
    !!secret &&
    !id.startsWith("replace_with") &&
    !secret.startsWith("replace_with");

  if (!credsConfigured) return NextResponse.next();

  const token = await getToken({
    req,
    secret: authSecret(),
    secureCookie: useSecureCookies(),
  });

  // Re-authenticate when there is no token, the refresh failed (expired
  // session), or the token carries no usable access token. The last case must
  // match lib/serverSession.getAccessToken — otherwise such a token slips past
  // middleware and crashes server components with DriveAuthError.
  if (!token || token.error || !token.accessToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Surface the current path to the root layout (Server Components cannot read
  // it otherwise) so the layout can run a final auth guard that matches
  // getAccessToken — catching the rare case where the edge-runtime token read
  // here succeeds but the node-runtime read in a page comes back empty.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Run on every route except NextAuth endpoints, the sign-in page, the public
// legal/support pages, and static assets. /privacy, /terms and /support must
// stay reachable without auth so signed-out visitors, Google's OAuth verifier
// and App Store reviewers can read them. Image assets (the logo, favicons) are
// excluded too — otherwise the auth redirect would break the logo on the
// public sign-in and legal pages.
// /api/drive/* is intentionally covered so Drive routes require auth.
export const config = {
  matcher: [
    "/((?!api/auth|signin|privacy|terms|support|manifest.webmanifest|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
