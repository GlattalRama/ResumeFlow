import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/serverSession";
import { isAdminSession } from "@/lib/admin";
import { getReport } from "@/lib/analytics/report";
import { storeBackend } from "@/lib/analytics/store";
import {
  EXPORT_FORMATS,
  isPeriod,
  PERIODS,
  type Period,
} from "@/lib/analytics/types";
import {
  BoltIcon,
  BriefcaseIcon,
  DocIcon,
} from "@/components/DashboardIcons";

export const dynamic = "force-dynamic";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  all: "All-time",
};

const DEFAULT_RANGE: Record<Period, number> = {
  day: 14,
  week: 12,
  month: 12,
  year: 5,
  all: 1,
};

// 2-letter ISO country code -> flag emoji (regional indicator symbols).
function flagEmoji(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

// ---- inline icons (not in DashboardIcons) ----
const iconBase = "h-5 w-5";
function LoginIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}
function UsersIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function DownloadIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

// Gradient bar chart for a metric's per-bucket series.
function Bars({
  values,
  labels,
  grad,
}: {
  values: number[];
  labels: string[];
  grad: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1" style={{ height: 88 }}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t-md bg-gradient-to-t ${grad} transition-all duration-500 hover:opacity-80`}
              style={{
                height: `${(v / max) * 100}%`,
                minHeight: v > 0 ? 3 : 0,
              }}
              title={`${labels[i]}: ${v}`}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] text-muted-foreground/70">
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  title,
  total,
  values,
  labels,
  icon,
  grad,
}: {
  title: string;
  total: number;
  values: number[];
  labels: string[];
  icon: React.ReactNode;
  grad: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {total}
          </p>
          <p className="text-[11px] text-muted-foreground/70">all-time total</p>
        </div>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm transition group-hover:scale-110`}
        >
          {icon}
        </span>
      </div>
      <Bars values={values} labels={labels} grad={grad} />
    </div>
  );
}

export default async function AnalyticsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; range?: string }>;
}) {
  const session = await getSession();
  if (!isAdminSession(session)) notFound();

  const sp = await searchParams;
  const period: Period = sp.period && isPeriod(sp.period) ? sp.period : "month";
  const rangeNum = Number(sp.range);
  const range =
    Number.isFinite(rangeNum) && rangeNum > 0
      ? Math.min(Math.floor(rangeNum), 366)
      : DEFAULT_RANGE[period];

  const report = await getReport(period, range);
  const { buckets, series, totals, countries } = report;

  const exportMax = Math.max(
    1,
    ...EXPORT_FORMATS.map((f) => totals.resume_exported[f])
  );
  const countryMax = Math.max(1, ...countries.map((c) => c.count));

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand-100/60 dark:bg-brand-500/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Analytics
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              Aggregate usage — no resume content is stored.
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {storeBackend()}
              </span>
            </p>
          </div>
          <nav className="inline-flex rounded-xl bg-muted p-1">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/admin/analytics?period=${p}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  p === period
                    ? "bg-card text-brand-700 dark:text-brand-300 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {/* ---- Metric cards ---- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Logins"
          total={totals.login}
          values={series.login}
          labels={buckets}
          icon={<LoginIcon />}
          grad="from-indigo-500 to-violet-500"
        />
        <MetricCard
          title="Active users"
          total={totals.activeUsers}
          values={series.activeUsers}
          labels={buckets}
          icon={<UsersIcon />}
          grad="from-fuchsia-500 to-pink-500"
        />
        <MetricCard
          title="Resumes created"
          total={totals.resume_created}
          values={series.resume_created}
          labels={buckets}
          icon={<DocIcon />}
          grad="from-sky-500 to-blue-600"
        />
        <MetricCard
          title="Applications created"
          total={totals.application_created}
          values={series.application_created}
          labels={buckets}
          icon={<BriefcaseIcon />}
          grad="from-emerald-500 to-teal-500"
        />
        <MetricCard
          title="AI-tailored resumes"
          total={totals.ai_tailored}
          values={series.ai_tailored}
          labels={buckets}
          icon={<BoltIcon />}
          grad="from-amber-500 to-orange-500"
        />
        <MetricCard
          title="Exports (all formats)"
          total={totals.resume_exported.total}
          values={series.resume_exported.total}
          labels={buckets}
          icon={<DownloadIcon />}
          grad="from-rose-500 to-red-500"
        />
      </section>

      {/* ---- Breakdowns ---- */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">
            Exports by format
          </h3>
          <p className="mb-4 text-xs text-muted-foreground/70">all-time</p>
          <ul className="space-y-3">
            {EXPORT_FORMATS.map((fmt) => {
              const n = totals.resume_exported[fmt];
              return (
                <li key={fmt} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {fmt}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500"
                      style={{ width: `${Math.round((n / exportMax) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground/80">
                    {n}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">
            Logins by country
          </h3>
          <p className="mb-4 text-xs text-muted-foreground/70">all-time, where known</p>
          {countries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground/70">
              No data yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {countries.slice(0, 12).map((c) => (
                <li key={c.code} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-sm text-muted-foreground">
                    {flagEmoji(c.code)} {c.code}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500"
                      style={{
                        width: `${Math.round((c.count / countryMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground/80">
                    {c.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
