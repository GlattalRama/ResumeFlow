import { PageHeader } from "@/components/ui";
import ResumeBuilder from "@/components/ResumeBuilder";
import { resolveVisibleTemplates } from "@/lib/constants";
import { loadTemplateVisibility } from "@/lib/aiSettings";

export const dynamic = "force-dynamic";

export default async function NewResumePage() {
  const availableTemplates = resolveVisibleTemplates(
    await loadTemplateVisibility()
  );
  return (
    <div>
      <PageHeader
        title="New resume"
        subtitle="Fill in your details and pick a template. The preview updates live."
      />
      <ResumeBuilder mode="create" availableTemplates={availableTemplates} />
    </div>
  );
}
