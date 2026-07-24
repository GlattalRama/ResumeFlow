import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import ConnectDriveActions from "@/components/ConnectDriveActions";
import { getSession } from "@/lib/serverSession";
import { hasGoogleCredentials } from "@/lib/googleConfig";

export const dynamic = "force-dynamic";

// Storage-connect step for logins that don't grant Google Drive access
// (Sign in with Apple). ResumeFlow stores nothing on its own servers — every
// user's data lives in a cloud they control, so an account without a
// connected Drive can't enter the app yet. Middleware routes such sessions
// here (and only here).
export default async function ConnectDrivePage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const target = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";
  const t = await getTranslations("connectDrive");

  if (!hasGoogleCredentials()) redirect("/");

  const session = (await getSession()) as {
    user?: { email?: string | null; name?: string | null };
    driveConnected?: boolean;
    error?: string;
  } | null;

  // Not signed in (or broken session) — sign-in comes first.
  if (!session || session.error) redirect("/signin");
  // Drive already connected — nothing to do here.
  if (session.driveConnected) redirect(target);

  const who = session.user?.email ?? session.user?.name ?? null;

  const errorMessage =
    error === "denied"
      ? t("errorDenied")
      : error === "scope_missing"
        ? t("errorScope")
        : error
          ? t("genericError")
          : null;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-10">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-lg shadow-gray-200/60 dark:shadow-black/40">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="h-14 w-auto" />
          <h1 className="mt-3 text-xl font-bold text-foreground">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("sub")}
          </p>
        </div>

        <div className="mb-6 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {t("privacyNote")}
        </div>

        {errorMessage && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </p>
        )}

        <ConnectDriveActions callbackUrl={target} />

        {who && (
          <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
            {t("signedInAs", { who })}
          </p>
        )}

        <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
          <Link href="/privacy" className="hover:underline">
            {t("privacy")}
          </Link>
          <span className="mx-1.5">·</span>
          <Link href="/support" className="hover:underline">
            {t("support")}
          </Link>
        </p>
      </div>
    </div>
  );
}
