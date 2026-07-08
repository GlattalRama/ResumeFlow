import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui";
import {
  BoltIcon,
  BriefcaseIcon,
  ChatIcon,
  DocIcon,
  PlusIcon,
} from "@/components/DashboardIcons";
import { BookIcon, GearIcon } from "@/components/native/NativeIcons";
import type { Application, ResumeVersion } from "@/lib/types";

// Home screen shown on "/" inside the native (Android app) shell — an
// app-style stats banner + quick-actions grid + recent-items cards, replacing
// the desktop dashboard. Rendered by app/page.tsx when the request comes from
// the Capacitor WebView; receives its data from the same loads the dashboard
// already does.
export default async function AppHome({
  firstName,
  counts,
  recentResumes,
  recentApps,
  locale,
}: {
  firstName?: string;
  counts: { resumes: number; active: number; prep: number };
  recentResumes: ResumeVersion[];
  recentApps: Application[];
  locale: string;
}) {
  const t = await getTranslations("appHome");

  const stats = [
    { value: counts.resumes, label: t("statResumes"), href: "/resumes" },
    { value: counts.active, label: t("statActive"), href: "/applications" },
    { value: counts.prep, label: t("statPrep"), href: "/interview-prep" },
  ];

  // Quick-action tiles, MyGate-style: an icon square + short label. The first
  // tile is the primary action and gets the filled brand treatment.
  const actions = [
    {
      href: "/resumes/new",
      label: t("qaNewResume"),
      icon: <PlusIcon className="h-6 w-6" />,
      iconClass: "bg-gradient-to-br from-brand-500 to-violet-600 text-white",
    },
    {
      href: "/resumes",
      label: t("qaMyResumes"),
      icon: <DocIcon className="h-6 w-6" />,
      iconClass: "bg-card text-brand-600 dark:text-brand-300",
    },
    {
      href: "/applications/new",
      label: t("qaNewJob"),
      icon: <PlusIcon className="h-6 w-6" />,
      iconClass: "bg-card text-sky-600 dark:text-sky-400",
    },
    {
      href: "/applications",
      label: t("qaJobs"),
      icon: <BriefcaseIcon className="h-6 w-6" />,
      iconClass: "bg-card text-blue-600 dark:text-blue-400",
    },
    {
      href: "/interview-coach",
      label: t("qaInterview"),
      icon: <ChatIcon className="h-6 w-6" />,
      iconClass: "bg-card text-violet-600 dark:text-violet-400",
    },
    {
      href: "/interview-prep",
      label: t("qaPrep"),
      icon: <BoltIcon className="h-6 w-6" />,
      iconClass: "bg-card text-amber-600 dark:text-amber-400",
    },
    {
      href: "/work-journal",
      label: t("qaJournal"),
      icon: <BookIcon className="h-6 w-6" />,
      iconClass: "bg-card text-emerald-600 dark:text-emerald-400",
    },
    {
      href: "/settings",
      label: t("qaSettings"),
      icon: <GearIcon className="h-6 w-6" />,
      iconClass: "bg-card text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ---- Greeting ---- */}
      <section>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {firstName ? t("greeting", { name: firstName }) : t("greetingAnon")}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("tagline")}</p>
      </section>

      {/* ---- Stats banner ---- */}
      <section className="grid grid-cols-3 divide-x divide-white/20 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 shadow-sm">
        {stats.map((s) => (
          <Link key={s.href + s.label} href={s.href} className="px-3 py-4 text-center">
            <p className="text-2xl font-bold tabular-nums text-white">{s.value}</p>
            <p className="mt-0.5 text-[11px] font-medium leading-tight text-white/80">
              {s.label}
            </p>
          </Link>
        ))}
      </section>

      {/* ---- Quick actions ---- */}
      <section>
        <h2 className="mb-3 text-base font-bold tracking-tight text-foreground">
          {t("quickActions")}
        </h2>
        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
          {actions.map((a) => (
            <Link key={a.href + a.label} href={a.href} className="flex flex-col items-center gap-1.5">
              <span
                className={`grid h-14 w-14 place-items-center rounded-2xl border border-border shadow-sm transition active:scale-95 ${a.iconClass}`}
              >
                {a.icon}
              </span>
              <span className="line-clamp-2 max-w-full text-center text-[11px] font-medium leading-tight text-foreground/80">
                {a.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Recent resumes ---- */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t("recentResumes")}</h2>
          <Link
            href="/resumes"
            className="text-xs font-semibold text-brand-600 dark:text-brand-300"
          >
            {t("viewAll")}
          </Link>
        </div>
        {recentResumes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground/70">
            {t("emptyResumes")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentResumes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/resumes/${r.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.versionName || t("untitled")}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                    {t("updatedOn", {
                      date: shortDate(r.updatedAt || r.createdAt, locale),
                    })}
                  </p>
                </Link>
                <Link
                  href={`/resumes/${r.id}/edit`}
                  className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {t("edit")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Recent applications ---- */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t("recentApps")}</h2>
          <Link
            href="/applications"
            className="text-xs font-semibold text-brand-600 dark:text-brand-300"
          >
            {t("viewAll")}
          </Link>
        </div>
        {recentApps.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground/70">
            {t("emptyApps")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentApps.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/applications/${a.id}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.jobTitle || t("untitled")}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                      {a.company || "—"}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// "Jun 7, 2026" style absolute date in the active locale (same behavior as the
// dashboard's helper). Returns "—" for invalid/empty input.
function shortDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
