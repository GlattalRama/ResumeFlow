import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { readAll } from "@/lib/store";
import { getSession } from "@/lib/serverSession";
import {
  APPLICATION_STATUSES,
  TEMPLATES,
  normalizeTemplateId,
} from "@/lib/constants";
import { EmptyState, StatusBadge, buttonClass } from "@/components/ui";
import {
  ActivityDot,
  BoltIcon,
  BriefcaseIcon,
  ChatIcon,
  DocIcon,
  PlusIcon,
} from "@/components/DashboardIcons";
import type { Application, ApplicationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// Statuses considered "closed" — excluded from the Active Applications metric.
const CLOSED_STATUSES: ApplicationStatus[] = ["Rejected", "Withdrawn"];

// Gradient fills for the application pipeline bars, keyed by status.
const STATUS_GRAD: Record<ApplicationStatus, string> = {
  Saved: "from-slate-300 to-slate-400",
  Applied: "from-sky-400 to-blue-600",
  "Phone Screen": "from-amber-400 to-orange-500",
  Interview: "from-violet-400 to-purple-600",
  Offer: "from-emerald-400 to-teal-500",
  Rejected: "from-rose-400 to-red-500",
  Withdrawn: "from-slate-200 to-slate-300",
};

export default async function DashboardPage() {
  const [resumes, applications, qna, notes, statusHistory, session] =
    await Promise.all([
      readAll("resumes"),
      readAll("applications"),
      readAll("qna"),
      readAll("notes"),
      readAll("statusHistory"),
      getSession(),
    ]);
  const t = await getTranslations("dashboard");
  const tStatus = await getTranslations("status");
  const locale = await getLocale();

  const firstName = session?.user?.name?.trim().split(/\s+/)[0];

  // ---- Metrics ----
  const activeCount = applications.filter(
    (a) => !CLOSED_STATUSES.includes(a.status)
  ).length;

  const metrics = [
    {
      label: t("metricResumes"),
      value: resumes.length,
      helper: t("metricResumesHelper"),
      href: "/resumes",
      icon: <DocIcon />,
      grad: "from-indigo-500 to-violet-500",
    },
    {
      label: t("metricApplications"),
      value: applications.length,
      helper: t("metricApplicationsHelper"),
      href: "/applications",
      icon: <BriefcaseIcon />,
      grad: "from-sky-500 to-blue-600",
    },
    {
      label: t("metricActive"),
      value: activeCount,
      helper: t("metricActiveHelper"),
      href: "/applications",
      icon: <BoltIcon />,
      grad: "from-emerald-500 to-teal-500",
    },
    {
      label: t("metricPrep"),
      value: qna.length,
      helper: t("metricPrepHelper"),
      href: "/applications",
      icon: <ChatIcon />,
      grad: "from-amber-500 to-orange-500",
    },
  ];

  // ---- Pipeline ----
  const pipeline = APPLICATION_STATUSES.map((status) => ({
    status,
    count: applications.filter((a) => a.status === status).length,
  }));
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.count));

  // ---- Recent applications / resumes ----
  const resumeNameById = new Map(resumes.map((r) => [r.id, r.versionName]));
  const sortByUpdated = <T extends { updatedAt: string; createdAt: string }>(
    items: T[]
  ) =>
    [...items].sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
    );

  const recentApps = sortByUpdated(applications).slice(0, 5);
  const recentResumes = sortByUpdated(resumes).slice(0, 5);

  // ---- Recent activity (derived from timestamps + status history) ----
  const appById = new Map(applications.map((a) => [a.id, a]));
  const appLabel = (a: Application | undefined) =>
    a
      ? `${a.jobTitle || t("untitledRole")} · ${a.company || t("unknownCompany")}`
      : t("anApplication");

  type ActivityItem = {
    at: string;
    text: string;
    href?: string;
    tone: string;
  };
  const events: ActivityItem[] = [];

  for (const r of resumes) {
    events.push({
      at: r.createdAt,
      text: t("createdResume", { name: r.versionName || t("untitled") }),
      href: `/resumes/${r.id}`,
      tone: "text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15",
    });
    if (r.updatedAt && r.updatedAt !== r.createdAt) {
      events.push({
        at: r.updatedAt,
        text: t("updatedResume", { name: r.versionName || t("untitled") }),
        href: `/resumes/${r.id}`,
        tone: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40",
      });
    }
  }
  for (const a of applications) {
    events.push({
      at: a.createdAt,
      text: t("addedApplication", { label: appLabel(a) }),
      href: `/applications/${a.id}`,
      tone: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40",
    });
  }
  for (const s of statusHistory) {
    const a = appById.get(s.applicationId);
    events.push({
      at: s.changedAt,
      text: t("movedTo", { label: appLabel(a), status: tStatus(s.newStatus) }),
      href: a ? `/applications/${a.id}` : undefined,
      tone: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40",
    });
  }
  for (const n of notes) {
    const a = appById.get(n.applicationId);
    events.push({
      at: n.createdAt,
      text: t("addedNote", { label: appLabel(a) }),
      href: a ? `/applications/${a.id}` : undefined,
      tone: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
    });
  }
  for (const q of qna) {
    const a = appById.get(q.applicationId);
    events.push({
      at: q.createdAt,
      text: t("addedQna", { label: appLabel(a) }),
      href: a ? `/interview-prep/${a.id}` : undefined,
      tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
    });
  }
  const recentActivity = events
    .filter((e) => e.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const totalApps = applications.length;

  return (
    <div className="space-y-8">
      {/* ---- Hero ---- */}
      <section className="overflow-hidden rounded-2xl border border-brand-100 dark:border-brand-500/30 bg-gradient-to-br from-brand-50 dark:from-brand-950 via-background to-background p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {firstName ? t("welcome", { name: firstName }) : t("welcomeAnon")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/resumes/new" className={buttonClass("primary")}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              {t("newResume")}
            </Link>
            <Link href="/applications/new" className={buttonClass("secondary")}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              {t("newApplication")}
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Metric cards ---- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-transparent transition hover:-translate-y-1 hover:shadow-xl hover:ring-brand-100 dark:hover:ring-brand-500/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
                  {m.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">{m.helper}</p>
              </div>
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${m.grad} text-white shadow-sm transition group-hover:scale-110`}
              >
                {m.icon}
              </span>
            </div>
            <span
              className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${m.grad} opacity-0 transition group-hover:opacity-100`}
            />
          </Link>
        ))}
      </section>

      {/* ---- Pipeline + Recent activity ---- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title={t("pipelineTitle")}
          subtitle={t("pipelineSubtitle")}
          action={
            <Link
              href="/applications"
              className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              {t("viewAll")}
            </Link>
          }
        >
          {applications.length === 0 ? (
            <EmptyState
              title={t("emptyAppsTitle")}
              hint={t("emptyAppsHint")}
              cta={{ href: "/applications/new", label: t("addApplication") }}
            />
          ) : (
            <ul className="space-y-3.5">
              {pipeline.map((p) => {
                const pct = Math.round((p.count / totalApps) * 100) || 0;
                return (
                  <li key={p.status} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground sm:w-28">
                      {tStatus(p.status)}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${STATUS_GRAD[p.status]} transition-all duration-500`}
                        style={{
                          width: `${Math.max(
                            p.count > 0 ? 6 : 0,
                            Math.round((p.count / pipelineMax) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground/80">
                      {p.count}
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground/70">
                        {pct}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("activityTitle")} subtitle={t("activitySubtitle")}>
          {recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground/70">
              {t("noActivity")}
            </p>
          ) : (
            <ul className="relative space-y-1 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-muted">
              {recentActivity.map((e, i) => {
                const row = (
                  <div className="flex items-start gap-3">
                    <span
                      className={`relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-4 ring-background ${e.tone}`}
                    >
                      <ActivityDot className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm leading-snug text-foreground/80">
                        {e.text}
                      </p>
                      <p className="text-xs text-muted-foreground/70">{timeAgo(e.at, t)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={i}>
                    {e.href ? (
                      <Link
                        href={e.href}
                        className="-mx-2 block rounded-lg px-2 py-1.5 transition hover:bg-muted/50"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="px-2 py-1.5">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </section>

      {/* ---- Recent applications + Recent resume versions ---- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("recentAppsTitle")}
          subtitle={t("recentSubtitle")}
          action={
            <Link
              href="/applications"
              className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              {t("viewAll")}
            </Link>
          }
        >
          {recentApps.length === 0 ? (
            <EmptyState
              title={t("emptyAppsTitle")}
              hint={t("trackAJob")}
              cta={{ href: "/applications/new", label: t("addApplication") }}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentApps.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/applications/${a.id}`}
                    className="-mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.jobTitle || t("untitledRole")}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {a.company || t("unknownCompany")}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                        {resumeNameById.get(a.resumeVersionUsed) ??
                          t("noResumeLinked")}{" "}
                        ·{" "}
                        {t("updatedOn", {
                          date: shortDate(a.updatedAt || a.createdAt, locale),
                        })}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t("recentResumesTitle")}
          subtitle={t("recentSubtitle")}
          action={
            <Link
              href="/resumes"
              className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              {t("viewAll")}
            </Link>
          }
        >
          {recentResumes.length === 0 ? (
            <EmptyState
              title={t("emptyResumesTitle")}
              hint={t("emptyResumesHint")}
              cta={{ href: "/resumes/new", label: t("createResume") }}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentResumes.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.versionName || t("untitledVersion")}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                        {r.targetRole || t("noTargetRole")} ·{" "}
                        {templateName(r.selectedTemplate)} ·{" "}
                        {t("updatedOn", {
                          date: shortDate(r.updatedAt || r.createdAt, locale),
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <QuickAction href={`/resumes/${r.id}`} label={t("preview")} />
                    <QuickAction href={`/resumes/${r.id}/edit`} label={t("edit")} />
                    <QuickAction href={`/resumes/${r.id}`} label={t("export")} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>
    </div>
  );
}

// ---- Presentational helpers ----

function SectionCard({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-brand-300 dark:hover:border-brand-400/60 hover:bg-brand-50 dark:hover:bg-brand-500/15 hover:text-brand-700 dark:hover:text-brand-300"
    >
      {label}
    </Link>
  );
}

function templateName(id: string): string {
  const normalized = normalizeTemplateId(id);
  return TEMPLATES.find((t) => t.id === normalized)?.name ?? normalized;
}

// "2d ago" style relative time, localized via the dashboard.timeAgo messages.
// Returns "" for invalid/empty input.
type TimeAgoT = (key: string, values?: Record<string, number>) => string;
function timeAgo(iso: string, t: TimeAgoT): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return t("timeAgo.justNow");
  if (min < 60) return t("timeAgo.minutes", { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t("timeAgo.hours", { n: hr });
  const day = Math.round(hr / 24);
  if (day < 30) return t("timeAgo.days", { n: day });
  const mo = Math.round(day / 30);
  if (mo < 12) return t("timeAgo.months", { n: mo });
  return t("timeAgo.years", { n: Math.round(mo / 12) });
}

// "Jun 7, 2026" style absolute date in the active locale. Returns "—" for
// invalid/empty input.
function shortDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
