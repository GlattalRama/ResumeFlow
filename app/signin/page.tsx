import { redirect } from "next/navigation";
import Link from "next/link";
import SignInButton from "@/components/SignInButton";
import { getSession, getAccessToken } from "@/lib/serverSession";
import { hasGoogleCredentials } from "@/lib/googleConfig";

export const dynamic = "force-dynamic";

// Highlights shown on the sign-in landing hero.
const FEATURES = [
  {
    title: "AI-tailored resumes",
    desc: "Match every resume to the job description in seconds.",
  },
  {
    title: "Beat the ATS",
    desc: "Clean, parseable templates that applicant-tracking systems can read.",
  },
  {
    title: "Track every application",
    desc: "See all your roles in one clear pipeline, from saved to offer.",
  },
  {
    title: "Interview prep",
    desc: "Get AI-generated questions and answer guidance for each job.",
  },
  {
    title: "Export anywhere",
    desc: "Download polished PDF, Word, and PowerPoint versions.",
  },
  {
    title: "Private by design",
    desc: "Your data is saved to your own Google Drive — not our servers.",
  },
];

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
    <div className="relative overflow-hidden">
      {/* Decorative brand-colored gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#0033a0]/10 dark:bg-blue-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-green-500/10 blur-3xl"
      />

      <div className="relative grid items-center gap-10 py-6 lg:grid-cols-2 lg:gap-16 lg:py-16">
        {/* ---- Left: hero copy ---- */}
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0033a0]/20 bg-[#0033a0]/5 px-3 py-1 text-xs font-semibold text-[#0033a0] dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            AI-powered resume builder &amp; job tracker
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
            Land more interviews with resumes built to{" "}
            <span className="text-[#0033a0] dark:text-blue-300">beat the ATS</span>.
          </h1>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Resumeflow-ATS helps you tailor each resume to the job, track every
            application, and prepare for interviews — all in one place, with your
            data saved privately to your own Google Drive.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300">
                  <CheckIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {f.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- Right: sign-in card ---- */}
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg shadow-gray-200/60 dark:shadow-black/40">
            <div className="mb-6 flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.png" alt="" className="h-14 w-auto" />
              <h2 className="mt-3 text-xl font-bold text-foreground">
                Get started free
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to create your first tailored resume in minutes.
              </p>
            </div>

            {credsConfigured ? (
              <SignInButton callbackUrl={target} />
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200">
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

            <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
              We request access only to Resumeflow-ATS&apos;s own app data folder
              in your Google Drive.
            </p>

            <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
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
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
