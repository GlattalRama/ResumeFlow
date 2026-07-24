"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import {
  isNativePlatform,
  isNativeIOS,
  nativeGoogleSignIn,
  nativeAppleSignIn,
} from "@/lib/nativeAuth";

// Sign-in options. Google is always offered. Apple is offered when the server
// has Sign in with Apple configured (showApple) — on the web and in the iOS
// shell, but not in the Android shell (no native Apple support there).
export default function SignInButton({
  callbackUrl = "/",
  showApple = false,
}: {
  callbackUrl?: string;
  showApple?: boolean;
}) {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appleVisible =
    showApple && (!isNativePlatform() || isNativeIOS());

  async function handleGoogleSignIn() {
    setError(null);
    setLoading("google");
    try {
      // Inside the Capacitor shell Google blocks the WebView OAuth redirect, so
      // sign in natively and let the server mint the session cookie.
      if (isNativePlatform()) {
        await nativeGoogleSignIn();
        window.location.assign(callbackUrl);
        return;
      }
      // Web: normal NextAuth redirect (this navigates away).
      await signIn("google", { callbackUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
      setLoading(null);
    }
  }

  async function handleAppleSignIn() {
    setError(null);
    setLoading("apple");
    try {
      if (isNativeIOS()) {
        await nativeAppleSignIn();
        // No Drive is connected yet — middleware routes to /connect-drive.
        window.location.assign(callbackUrl);
        return;
      }
      await signIn("apple", { callbackUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
      setLoading(null);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={loading !== null}
        onClick={handleGoogleSignIn}
        className="inline-flex w-full items-center justify-center gap-3 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground/80 shadow-sm transition hover:bg-muted/50 disabled:opacity-60"
      >
        <GoogleIcon />
        {loading === "google" ? "Signing in…" : "Sign in with Google"}
      </button>
      {appleVisible && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={handleAppleSignIn}
          className="mt-3 inline-flex w-full items-center justify-center gap-3 rounded-md border border-black bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black/85 disabled:opacity-60 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          <AppleIcon />
          {loading === "apple" ? "Signing in…" : "Sign in with Apple"}
        </button>
      )}
      {error && (
        <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.54c-.03-2.87 2.35-4.25 2.45-4.31-1.33-1.95-3.41-2.22-4.15-2.25-1.77-.18-3.45 1.04-4.35 1.04-.89 0-2.28-1.01-3.75-.99-1.93.03-3.71 1.12-4.7 2.85-2 3.47-.51 8.6 1.44 11.42.95 1.38 2.09 2.93 3.58 2.87 1.44-.06 1.98-.93 3.72-.93 1.73 0 2.22.93 3.74.9 1.55-.03 2.53-1.4 3.47-2.79 1.1-1.6 1.55-3.15 1.57-3.23-.03-.02-3-1.15-3.02-4.58zM14.19 4.11c.8-.96 1.33-2.3 1.18-3.63-1.14.05-2.53.76-3.35 1.72-.73.85-1.38 2.21-1.2 3.51 1.27.1 2.57-.64 3.37-1.6z" />
    </svg>
  );
}
