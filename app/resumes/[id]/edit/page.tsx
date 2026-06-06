import { notFound } from "next/navigation";
import { getItem } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import ResumeBuilder from "@/components/ResumeBuilder";

export const dynamic = "force-dynamic";

export default async function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resume = await getItem("resumes", id);
  if (!resume) notFound();

  return (
    <div>
      <PageHeader
        title="Edit resume"
        subtitle={`${resume.versionName} · v${resume.versionNumber}`}
      />
      <ResumeBuilder mode="edit" initial={resume} />
    </div>
  );
}
