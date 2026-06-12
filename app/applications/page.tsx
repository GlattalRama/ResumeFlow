import Link from "next/link";
import { readAll } from "@/lib/store";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const apps = (await readAll("applications")).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Track every job you've applied to and what's next."
        action={
          <Link href="/applications/new" className={buttonClass("primary")}>
            + New application
          </Link>
        }
      />

      {apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          hint="Add a job application to start tracking it."
          cta={{ href: "/applications/new", label: "Add application" }}
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Link key={a.id} href={`/applications/${a.id}`}>
              <Card className="transition hover:border-brand-300 dark:hover:border-brand-400/60 hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {a.jobTitle || "Untitled role"}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {a.company || "Unknown company"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.jobId ? `Job ID ${a.jobId}` : "No job ID"}
                      {a.appliedDate ? ` · Applied ${a.appliedDate}` : ""}
                    </p>
                    {a.nextAction && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Next: {a.nextAction}
                        {a.nextActionDate ? ` (${a.nextActionDate})` : ""}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
