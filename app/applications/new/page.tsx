import { getTranslations } from "next-intl/server";
import { readAll } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import ApplicationForm from "@/components/ApplicationForm";

export const dynamic = "force-dynamic";

export default async function NewApplicationPage() {
  const t = await getTranslations("application");
  const resumes = await readAll("resumes");
  const resumeOptions = resumes.map((r) => ({
    id: r.id,
    label: `${r.versionName} (v${r.versionNumber})`,
  }));

  return (
    <div>
      <PageHeader
        title={t("new.title")}
        subtitle={t("new.subtitle")}
      />
      <ApplicationForm mode="create" resumeOptions={resumeOptions} />
    </div>
  );
}
