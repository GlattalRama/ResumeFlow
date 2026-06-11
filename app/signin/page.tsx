import { redirect } from "next/navigation";
import Link from "next/link";
import SignInButton from "@/components/SignInButton";
import { getSession, getAccessToken } from "@/lib/serverSession";
import { hasGoogleCredentials } from "@/lib/googleConfig";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";

  const credsConfigured = hasGoogleCredentials();

  // Already signed in with a valid session — go straight to the app.
  // A session whose token refresh has failed carries an `error`; we must NOT
  // redirect in that case, or middleware will bounce the user right back here
  // (infinite loop). We also require a readable access token via the SAME
  // reader the layout guard uses — otherwise a session that decodes here but
  // not in a page would ping-pong between /signin and the target page.
  if (credsConfigured) {
    const session = (await getSession()) as { error?: string } | null;
    const token = await getAccessToken();
    if (session && !session.error && token) redirect(target);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-lg font-semibold text-white">
            R
          </span>
          <h1 className="mt-3 text-xl font-bold text-gray-900">ResumeFlow</h1>
          <p className="mt-1 text-sm text-gray-500">
            Build resumes and track applications. Your data is saved to your own
            Google Drive.
          </p>
        </div>

        {credsConfigured ? (
          <SignInButton callbackUrl={target} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Google sign-in is not configured. The app is running in local
              development mode and stores data in <code>/data</code>. Set{" "}
              <code>GOOGLE_CLIENT_ID</code> and{" "}
              <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code> to
              enable Google Drive storage.
            </div>
            <Link
              href={target}
              className="inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Continue in local mode
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-gray-400">
          We request access only to ResumeFlow&apos;s own app data folder in
          your Google Drive.
        </p>

        <p className="mt-3 text-center text-[11px] text-gray-400">
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <span className="mx-1.5">·</span>
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
