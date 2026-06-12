import Link from "next/link";
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

  const firstName = session?.user?.name?.trim().split(/\s+/)[0];

  // ---- Metrics ----
  const activeCount = applications.filter(
    (a) => !CLOSED_STATUSES.includes(a.status)
  ).length;

  const metrics = [
    {
      label: "Resume Versions",
      value: resumes.length,
      helper: "Tailored resume documents",
      href: "/resumes",
      icon: <DocIcon />,
      grad: "from-indigo-500 to-violet-500",
    },
    {
      label: "Applications",
      value: applications.length,
      helper: "Jobs you're tracking",
      href: "/applications",
      icon: <BriefcaseIcon />,
      grad: "from-sky-500 to-blue-600",
    },
    {
      label: "Active Applications",
      value: activeCount,
      helper: "Not rejected or withdrawn",
      href: "/applications",
      icon: <BoltIcon />,
      grad: "from-emerald-500 to-teal-500",
    },
    {
      label: "Interview Prep Items",
      value: qna.length,
      helper: "Saved Q&A to practice",
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
      ? `${a.jobTitle || "Untitled role"} · ${a.company || "Unknown company"}`
      : "an application";

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
      text: `Created resume “${r.versionName || "Untitled"}”`,
      href: `/resumes/${r.id}`,
      tone: "text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15",
    });
    if (r.updatedAt && r.updatedAt !== r.createdAt) {
      events.push({
        at: r.updatedAt,
        text: `Updated resume “${r.versionName || "Untitled"}”`,
        href: `/resumes/${r.id}`,
        tone: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40",
      });
    }
  }
  for (const a of applications) {
    events.push({
      at: a.createdAt,
      text: `Added application — ${appLabel(a)}`,
      href: `/applications/${a.id}`,
      tone: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40",
    });
  }
  for (const s of statusHistory) {
    const a = appById.get(s.applicationId);
    events.push({
      at: s.changedAt,
      text: `Moved ${appLabel(a)} to ${s.newStatus}`,
      href: a ? `/applications/${a.id}` : undefined,
      tone: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40",
    });
  }
  for (const n of notes) {
    const a = appById.get(n.applicationId);
    events.push({
      at: n.createdAt,
      text: `Added a note on ${appLabel(a)}`,
      href: a ? `/applications/${a.id}` : undefined,
      tone: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
    });
  }
  for (const q of qna) {
    const a = appById.get(q.applicationId);
    events.push({
      at: q.createdAt,
      text: `Added interview Q&A for ${appLabel(a)}`,
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
              Welcome back{firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Manage your resumes, applications, and interview preparation in one
              place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/resumes/new" className={buttonClass("primary")}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Resume
            </Link>
            <Link href="/applications/new" className={buttonClass("secondary")}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Application
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
          title="Application pipeline"
          subtitle="Applications by status"
          action={
            <Link
              href="/applications"
              className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              View all →
            </Link>
          }
        >
          {applications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              hint="Add a job application to start building your pipeline."
              cta={{ href: "/applications/new", label: "Add application" }}
            />
          ) : (
            <ul className="space-y-3.5">
              {pipeline.map((p) => {
                const pct = Math.round((p.count / totalApps) * 100) || 0;
                return (
                  <li key={p.status} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground sm:w-28">
                      {p.status}
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

        <SectionCard title="Recent activity" subtitle="Latest changes">
          {recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground/70">
              No activity yet. Create a resume or application to get started.
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
                      <p className="text-xs text-muted-foreground/70">{timeAgo(e.at)}</p>
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
          title="Recent applications"
          subtitle="Most recently updated"
          action={
            <Link
              href="/applications"
              className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              View all →
            </Link>
          }
        >
          {recentApps.length === 0 ? (
            <EmptyState
              title="No applications yet"
              hint="Track a job you've applied to."
              cta={{ href: "/applications/new", label: "Add application" }}
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
                        {a.jobTitle || "Untitled role"}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {a.company || "Unknown company"}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                        {resumeNameById.get(a.resumeVersionUsed) ??
                          "No resume linked"}{" "}
                        · Updated {shortDate(a.updatedAt || a.createdAt)}
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
          title="Recent resume versions"
          subtitle="Most recently updated"
          action={
            <Link
              href="/resumes"
              className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              View all →
            </Link>
          }
        >
          {recentResumes.length === 0 ? (
            <EmptyState
              title="No resumes yet"
              hint="Create your first resume version to get started."
              cta={{ href: "/resumes/new", label: "Create resume" }}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentResumes.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.versionName || "Untitled version"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                        {r.targetRole || "No target role"} ·{" "}
                        {templateName(r.selectedTemplate)} · Updated{" "}
                        {shortDate(r.updatedAt || r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <QuickAction href={`/resumes/${r.id}`} label="Preview" />
                    <QuickAction href={`/resumes/${r.id}/edit`} label="Edit" />
                    <QuickAction href={`/resumes/${r.id}`} label="Export" />
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

// "2d ago" style relative time. Returns "" for invalid/empty input.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

// "Jun 7, 2026" style absolute date. Returns "—" for invalid/empty input.
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
