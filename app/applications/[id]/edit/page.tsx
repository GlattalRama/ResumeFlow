import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getItem, readAll } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import ApplicationForm from "@/components/ApplicationForm";

export const dynamic = "force-dynamic";

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("application");
  const app = await getItem("applications", id);
  if (!app) notFound();

  const resumes = await readAll("resumes");
  const resumeOptions = resumes.map((r) => ({
    id: r.id,
    label: `${r.versionName} (v${r.versionNumber})`,
  }));

  return (
    <div>
      <PageHeader
        title={t("edit.title")}
        subtitle={`${app.jobTitle} · ${app.company}`}
      />
      <ApplicationForm mode="edit" initial={app} resumeOptions={resumeOptions} />
    </div>
  );
}
