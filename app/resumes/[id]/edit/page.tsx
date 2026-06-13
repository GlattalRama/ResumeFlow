import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getItem } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import ResumeBuilder from "@/components/ResumeBuilder";
import {
  TEMPLATES,
  normalizeTemplateId,
  resolveVisibleTemplates,
} from "@/lib/constants";
import { loadTemplateVisibility } from "@/lib/aiSettings";

export const dynamic = "force-dynamic";

export default async function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resume = await getItem("resumes", id);
  if (!resume) notFound();

  // Offer the admin-visible templates, but always include this resume's current
  // template (even if an admin has since hidden it) so editing never silently
  // switches the user's chosen template.
  const visible = resolveVisibleTemplates(await loadTemplateVisibility());
  const currentId = normalizeTemplateId(resume.selectedTemplate);
  const availableTemplates = visible.some((t) => t.id === currentId)
    ? visible
    : [...visible, ...TEMPLATES.filter((t) => t.id === currentId)];

  const t = await getTranslations("builder");
  return (
    <div>
      <PageHeader
        title={t("page.editTitle")}
        subtitle={`${resume.versionName} · v${resume.versionNumber}`}
      />
      <ResumeBuilder
        mode="edit"
        initial={resume}
        availableTemplates={availableTemplates}
      />
    </div>
  );
}
