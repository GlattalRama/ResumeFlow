import Link from "next/link";
import { readAll } from "@/lib/store";
import { APPLICATION_STATUSES } from "@/lib/constants";
import {
  Card,
  PageHeader,
  StatusBadge,
  buttonClass,
} from "@/components/ui";
import type { ApplicationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [resumes, applications] = await Promise.all([
    readAll("resumes"),
    readAll("applications"),
  ]);

  const byStatus = APPLICATION_STATUSES.map((status) => ({
    status,
    count: applications.filter((a) => a.status === status).length,
  })).filter((s) => s.count > 0);

  const recent = [...applications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your resumes and job applications at a glance."
        action={
          <div className="flex gap-2">
            <Link href="/resumes/new" className={buttonClass("secondary")}>
              + Resume
            </Link>
            <Link href="/applications/new" className={buttonClass("primary")}>
              + Application
            </Link>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Resume versions"
          value={resumes.length}
          href="/resumes"
        />
        <StatCard
          label="Applications"
          value={applications.length}
          href="/applications"
        />
        <StatCard
          label="Active (not closed)"
          value={
            applications.filter(
              (a) => !["Rejected", "Withdrawn"].includes(a.status)
            ).length
          }
          href="/applications"
        />
      </div>

      {/* By status */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Applications by status
          </h2>
          {byStatus.length === 0 ? (
            <p className="text-sm text-gray-400">No applications yet.</p>
          ) : (
            <ul className="space-y-2">
              {byStatus.map((s) => (
                <li
                  key={s.status}
                  className="flex items-center justify-between"
                >
                  <StatusBadge status={s.status as ApplicationStatus} />
                  <span className="text-sm font-medium text-gray-700">
                    {s.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Recent applications
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/applications/${a.id}`}
                    className="flex items-center justify-between py-2 hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-800">
                      {a.jobTitle || "Untitled"}{" "}
                      <span className="text-gray-400">· {a.company}</span>
                    </span>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition hover:border-brand-300 hover:shadow-md">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      </Card>
    </Link>
  );
}
