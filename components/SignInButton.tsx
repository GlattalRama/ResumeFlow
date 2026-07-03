"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { isNativePlatform, nativeGoogleSignIn } from "@/lib/nativeAuth";

export default function SignInButton({
  callbackUrl = "/",
}: {
  callbackUrl?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={handleSignIn}
        className="inline-flex w-full items-center justify-center gap-3 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground/80 shadow-sm transition hover:bg-muted/50 disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "Signing in…" : "Sign in with Google"}
      </button>
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
