import Link from "next/link";
import { readAll } from "@/lib/store";
import { TEMPLATES } from "@/lib/constants";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

function templateName(id: string) {
  return TEMPLATES.find((t) => t.id === id)?.name ?? id;
}

export default async function ResumesPage() {
  const resumes = (await readAll("resumes")).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );

  return (
    <div>
      <PageHeader
        title="Resume versions"
        subtitle="Create and manage tailored versions of your resume."
        action={
          <Link href="/resumes/new" className={buttonClass("primary")}>
            + New resume
          </Link>
        }
      />

      {resumes.length === 0 ? (
        <EmptyState
          title="No resume versions yet"
          hint="Create your first resume version to get started."
          cta={{ href: "/resumes/new", label: "Create resume" }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((r) => (
            <Link key={r.id} href={`/resumes/${r.id}`}>
              <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {r.versionName}
                    </p>
                    <p className="text-xs text-gray-500">
                      v{r.versionNumber}
                      {r.targetRole ? ` · ${r.targetRole}` : ""}
                    </p>
                  </div>
                  <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    {templateName(r.selectedTemplate)}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs text-gray-500">
                  {r.resumeData.basics.name || "—"}
                  {r.resumeData.basics.title
                    ? ` · ${r.resumeData.basics.title}`
                    : ""}
                </p>
                <p className="mt-3 text-[11px] text-gray-400">
                  Updated {new Date(r.updatedAt).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
