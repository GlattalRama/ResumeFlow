import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authSecret, useSecureCookies } from "@/lib/googleConfig";

// Protect ResumeFlow pages: unauthenticated users are redirected to /signin.
//
// When real Google credentials are NOT configured the app runs in local
// development mode — authentication is not enforced and every page is open.
export async function middleware(req: NextRequest) {
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

// Run on every route except NextAuth endpoints, the sign-in page, and static
// assets. /api/drive/* is intentionally covered so Drive routes require auth.
export const config = {
  matcher: [
    "/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)",
  ],
};
