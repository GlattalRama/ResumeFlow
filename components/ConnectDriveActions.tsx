"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { isNativePlatform, nativeConnectDrive } from "@/lib/nativeAuth";

// Client actions for the /connect-drive step: run the Google Drive connect
// flow (web redirect or native sheet) or sign out. Shown only to signed-in
// users whose login didn't grant Drive (Sign in with Apple).
export default function ConnectDriveActions({
  callbackUrl = "/",
}: {
  callbackUrl?: string;
}) {
  const t = useTranslations("connectDrive");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      if (isNativePlatform()) {
        // Google blocks OAuth in the WebView — use the native Google sheet and
        // merge the tokens into the existing session server-side.
        await nativeConnectDrive();
        window.location.assign(callbackUrl);
        return;
      }
      // Web: top-level redirect to Google's consent screen.
      window.location.assign(
        `/api/drive/connect?callbackUrl=${encodeURIComponent(callbackUrl)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("genericError"));
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleConnect}
        className="inline-flex w-full items-center justify-center gap-3 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        <DriveIcon />
        {loading ? t("connecting") : t("connectButton")}
      </button>
      {error && (
        <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/signin" })}
        className="mt-4 w-full text-center text-xs text-muted-foreground hover:underline"
      >
        {t("signOut")}
      </button>
    </div>
  );
}

function DriveIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#FFCF63" d="m8.4 3 7.2 0 6.9 12-7.2 0z" />
      <path fill="#11A861" d="m1.5 15 3.6-6.3L12.3 21l-7.2 0z" />
      <path fill="#3777E3" d="m5.1 21 3.6-6 13.8 0-3.45 6z" />
    </svg>
  );
}
