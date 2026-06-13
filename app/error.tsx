"use client";

// Route-level error boundary. Any uncaught error thrown while rendering a
// server component (most commonly a DriveAuthError when the Google session is
// missing or expired) lands here instead of Next's default error screen.
//
// In production Next.js replaces server-side error messages with a generic
// string, so we can't reliably branch on error.name. We instead lead with the
// most likely cause — an expired/missing sign-in — and offer to re-authenticate.
import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const t = useTranslations("ai");
  const [reauthing, setReauthing] = useState(false);

  useEffect(() => {
    // Surface the error in the server/console logs for debugging.
    console.error(error);
  }, [error]);

  // Combined sign-out + sign-in. When a Google refresh fails the JWT is left in
  // a RefreshAccessTokenError state; just signing in again can bounce straight
  // back here, and there was no way to sign out from the app to break the loop.
  // Clearing the session first guarantees a clean re-authentication.
  async function reauthenticate() {
    setReauthing(true);
    try {
      await signOut({ redirect: false });
    } catch {
      // Ignore — proceed to sign-in regardless of sign-out outcome.
    }
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="h-12 w-auto" />
          <h1 className="mt-3 text-xl font-bold text-foreground">
            {t("error.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("error.description")}
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={reauthenticate}
            disabled={reauthing}
            className="inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {reauthing ? t("error.signingIn") : t("error.tryAgain")}
          </button>
        </div>

        {error.digest ? (
          <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
            {t("error.reference", { digest: error.digest })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
