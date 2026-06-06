import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem } from "@/lib/store";
import { TEMPLATES } from "@/lib/constants";
import ResumePreviewPane from "@/components/ResumePreviewPane";

export const dynamic = "force-dynamic";

export default async function ResumePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resume = await getItem("resumes", id);
  if (!resume) notFound();

  const templateName =
    TEMPLATES.find((t) => t.id === resume.selectedTemplate)?.name ??
    resume.selectedTemplate;

  return (
    <div>
      <div className="no-print mb-6">
        <Link href="/resumes" className="text-sm text-brand-600 hover:underline">
          ← All resumes
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
          {resume.versionName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          v{resume.versionNumber}
          {resume.targetRole ? ` · ${resume.targetRole}` : ""} · Template:{" "}
          <span className="font-medium text-gray-700">{templateName}</span>
        </p>
      </div>

      <ResumePreviewPane
        id={resume.id}
        resumeData={resume.resumeData}
        selectedTemplate={resume.selectedTemplate}
        templateStyle={resume.templateStyle}
        sectionState={resume.sectionState}
      />
    </div>
  );
}
