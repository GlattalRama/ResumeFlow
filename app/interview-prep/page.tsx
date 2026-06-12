import Link from "next/link";
import { readAll } from "@/lib/store";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InterviewCoachPage() {
  const [apps, qna] = await Promise.all([
    readAll("applications"),
    readAll("qna"),
  ]);
  const sorted = [...apps].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const qnaCount = new Map<string, number>();
  for (const q of qna) {
    qnaCount.set(q.applicationId, (qnaCount.get(q.applicationId) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Interview Coach"
        subtitle="Pick an application to practice questions and prep for its interviews."
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No applications yet"
          hint="Interview prep is organised per application — add one to get started."
          cta={{ href: "/applications/new", label: "Add application" }}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const count = qnaCount.get(a.id) ?? 0;
            return (
              <Link key={a.id} href={`/interview-prep/${a.id}`}>
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
                        {count > 0
                          ? `${count} practice question${count === 1 ? "" : "s"}`
                          : "No practice questions yet"}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
