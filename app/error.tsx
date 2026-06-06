"use client";

// Route-level error boundary. Any uncaught error thrown while rendering a
// server component (most commonly a DriveAuthError when the Google session is
// missing or expired) lands here instead of Next's default error screen.
//
// In production Next.js replaces server-side error messages with a generic
// string, so we can't reliably branch on error.name. We instead lead with the
// most likely cause — an expired/missing sign-in — and offer to re-authenticate,
// while still providing a plain "Try again" for transient failures.
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in the server/console logs for debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-lg font-semibold text-white">
            R
          </span>
          <h1 className="mt-3 text-xl font-bold text-gray-900">
            Something went wrong
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your session may have expired. Sign in again to reconnect to your
            Google Drive, or retry the page.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/signin"
            className="inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Sign in again
          </Link>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Try again
          </button>
        </div>

        {error.digest ? (
          <p className="mt-6 text-center text-[11px] text-gray-400">
            Error reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
