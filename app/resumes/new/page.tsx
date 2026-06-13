import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import ResumeBuilder from "@/components/ResumeBuilder";
import { resolveVisibleTemplates } from "@/lib/constants";
import { loadTemplateVisibility } from "@/lib/aiSettings";

export const dynamic = "force-dynamic";

export default async function NewResumePage() {
  const availableTemplates = resolveVisibleTemplates(
    await loadTemplateVisibility()
  );
  const t = await getTranslations("builder");
  return (
    <div>
      <PageHeader
        title={t("page.newTitle")}
        subtitle={t("page.newSubtitle")}
      />
      <ResumeBuilder mode="create" availableTemplates={availableTemplates} />
    </div>
  );
}
