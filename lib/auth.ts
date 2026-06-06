import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { GOOGLE_SCOPES, authSecret, useSecureCookies } from "./googleConfig";

// Refresh an expired Google access token using the stored refresh token.
// Google only returns a refresh token on the first consent, so we request
// access_type=offline + prompt=consent below.
async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: (token.refreshToken as string) ?? "",
      }),
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      // expires_in is seconds-from-now; store an absolute unix-seconds expiry.
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
      // Google may not return a new refresh token; keep the existing one.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  secret: authSecret(),
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist the OAuth tokens in the (encrypted) JWT only.
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at, // unix seconds, from Google
        };
      }
      // Still valid (with a 60s safety margin) — reuse it.
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt * 1000 - 60_000) {
        return token;
      }
      // Expired — try to refresh.
      if (token.refreshToken) {
        return await refreshAccessToken(token as Record<string, unknown>);
      }
      return token;
    },
    async session({ session, token }) {
      // SECURITY: never copy accessToken/refreshToken onto the session — the
      // session is sent to the browser. Only surface a non-sensitive error flag
      // so the UI can prompt re-authentication when a refresh fails.
      if (token.error) {
        (session as { error?: string }).error = token.error as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
  useSecureCookies: useSecureCookies(),
};
