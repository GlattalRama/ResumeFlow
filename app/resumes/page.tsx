import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { readAll } from "@/lib/store";
import { TEMPLATES, normalizeTemplateId } from "@/lib/constants";
import { resolveBaseResumeId, isBaseResume } from "@/lib/baseResume";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import BaseResumeControl from "@/components/BaseResumeControl";

export const dynamic = "force-dynamic";

function templateName(id: string) {
  const normalized = normalizeTemplateId(id);
  return TEMPLATES.find((t) => t.id === normalized)?.name ?? normalized;
}

export default async function ResumesPage() {
  const [resumes, baseResumeId] = await Promise.all([
    readAll("resumes").then((rs) =>
      rs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    ),
    resolveBaseResumeId(),
  ]);
  const t = await getTranslations("resumes");
  const locale = await getLocale();

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link href="/resumes/new" className={buttonClass("primary")}>
            {t("new")}
          </Link>
        }
      />

      {resumes.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          hint={t("emptyHint")}
          cta={{ href: "/resumes/new", label: t("create") }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((r) => (
            <div key={r.id} className="relative">
              <Link href={`/resumes/${r.id}`} className="block h-full">
                <Card className="h-full transition hover:border-brand-300 dark:hover:border-brand-400/60 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {r.versionName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        v{r.versionNumber}
                        {r.targetRole ? ` · ${r.targetRole}` : ""}
                      </p>
                    </div>
                    <span className="rounded bg-brand-50 dark:bg-brand-500/15 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:text-brand-300">
                      {templateName(r.selectedTemplate)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {r.resumeData.basics.name || "—"}
                    {r.resumeData.basics.title
                      ? ` · ${r.resumeData.basics.title}`
                      : ""}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground/70">
                    {t("updatedOn", {
                      date: new Date(r.updatedAt).toLocaleDateString(locale),
                    })}
                  </p>
                </Card>
              </Link>
              <div className="absolute bottom-3 right-3">
                <BaseResumeControl
                  resumeId={r.id}
                  isBase={isBaseResume(r.id, baseResumeId)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
