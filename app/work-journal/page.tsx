import Link from "next/link";
import { readAll } from "@/lib/store";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { NoteType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<NoteType, string> = {
  general: "General",
  recruiter: "Recruiter",
  interview: "Interview",
  todo: "To-do",
};

const TYPE_CHIP: Record<NoteType, string> = {
  general:
    "bg-muted text-muted-foreground",
  recruiter:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  interview:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  todo: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

export default async function WorkJournalPage() {
  const [notes, apps] = await Promise.all([
    readAll("notes"),
    readAll("applications"),
  ]);
  const appById = new Map(apps.map((a) => [a.id, a]));
  const sorted = [...notes].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div>
      <PageHeader
        title="Work Journal"
        subtitle="Every note across your applications — recruiter calls, interviews, to-dos — in one timeline."
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No notes yet"
          hint="Notes you add on an application show up here as a single journal."
          cta={{ href: "/applications", label: "Go to applications" }}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((n) => {
            const app = appById.get(n.applicationId);
            return (
              <Card key={n.id}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${TYPE_CHIP[n.type]}`}
                  >
                    {TYPE_LABEL[n.type]}
                  </span>
                  {app ? (
                    <Link
                      href={`/applications/${app.id}`}
                      className="font-medium text-brand-600 dark:text-brand-300 hover:underline"
                    >
                      {app.jobTitle || "Untitled role"} ·{" "}
                      {app.company || "Unknown company"}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">
                      Deleted application
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {n.text}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
