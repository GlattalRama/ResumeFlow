import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("applications");

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link href="/applications/new" className={buttonClass("primary")}>
            {t("new")}
          </Link>
        }
      />

      {apps.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          hint={t("emptyHint")}
          cta={{ href: "/applications/new", label: t("add") }}
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Link key={a.id} href={`/applications/${a.id}`}>
              <Card className="transition hover:border-brand-300 dark:hover:border-brand-400/60 hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {a.jobTitle || t("untitledRole")}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {a.company || t("unknownCompany")}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.jobId ? t("jobId", { id: a.jobId }) : t("noJobId")}
                      {a.appliedDate
                        ? ` · ${t("appliedOn", { date: a.appliedDate })}`
                        : ""}
                    </p>
                    {a.nextAction && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {t("next", { action: a.nextAction })}
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
