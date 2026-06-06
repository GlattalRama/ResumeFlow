import { readAll } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import ApplicationForm from "@/components/ApplicationForm";

export const dynamic = "force-dynamic";

export default async function NewApplicationPage() {
  const resumes = await readAll("resumes");
  const resumeOptions = resumes.map((r) => ({
    id: r.id,
    label: `${r.versionName} (v${r.versionNumber})`,
  }));

  return (
    <div>
      <PageHeader
        title="New application"
        subtitle="Record a job you're applying to and link a resume version."
      />
      <ApplicationForm mode="create" resumeOptions={resumeOptions} />
    </div>
  );
}
