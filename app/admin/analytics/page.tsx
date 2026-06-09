import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/serverSession";
import { isAdminSession } from "@/lib/admin";
import { getReport } from "@/lib/analytics/report";
import { storeBackend } from "@/lib/analytics/store";
import { EXPORT_FORMATS, isPeriod, PERIODS, type Period } from "@/lib/analytics/types";

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

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1" style={{ height: 96 }}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-brand-500"
              style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
              title={`${labels[i]}: ${v}`}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] text-gray-400">
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
}: {
  title: string;
  total: number;
  values: number[];
  labels: string[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl font-semibold text-gray-900">{total}</span>
      </div>
      <p className="mb-2 text-xs text-gray-400">all-time</p>
      <Bars values={values} labels={labels} />
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
  const { buckets, series, totals } = report;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">
            Aggregate usage — no resume content is stored.{" "}
            <span className="text-gray-400">store: {storeBackend()}</span>
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/analytics?period=${p}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                p === period
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Logins"
          total={totals.login}
          values={series.login}
          labels={buckets}
        />
        <MetricCard
          title="Resumes created"
          total={totals.resume_created}
          values={series.resume_created}
          labels={buckets}
        />
        <MetricCard
          title="Applications created"
          total={totals.application_created}
          values={series.application_created}
          labels={buckets}
        />
        <MetricCard
          title="AI-tailored resumes"
          total={totals.ai_tailored}
          values={series.ai_tailored}
          labels={buckets}
        />
        <MetricCard
          title="Exports (all formats)"
          total={totals.resume_exported.total}
          values={series.resume_exported.total}
          labels={buckets}
        />
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-600">Exports by format</h3>
          <p className="mb-3 text-xs text-gray-400">all-time</p>
          <ul className="space-y-2">
            {EXPORT_FORMATS.map((fmt) => (
              <li
                key={fmt}
                className="flex items-center justify-between text-sm"
              >
                <span className="uppercase text-gray-500">{fmt}</span>
                <span className="font-semibold text-gray-900">
                  {totals.resume_exported[fmt]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
