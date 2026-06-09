import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem } from "@/lib/store";
import { TEMPLATES, normalizeTemplateId } from "@/lib/constants";
import { resolveBaseResumeId, isBaseResume } from "@/lib/baseResume";
import ResumePreviewPane from "@/components/ResumePreviewPane";

export const dynamic = "force-dynamic";

export default async function ResumePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [resume, baseResumeId] = await Promise.all([
    getItem("resumes", id),
    resolveBaseResumeId(),
  ]);
  if (!resume) notFound();
  const isBase = isBaseResume(resume.id, baseResumeId);

  const normalizedTemplate = normalizeTemplateId(resume.selectedTemplate);
  const templateName =
    TEMPLATES.find((t) => t.id === normalizedTemplate)?.name ??
    normalizedTemplate;

  return (
    <div>
      <div className="no-print mb-6">
        <Link href="/resumes" className="text-sm text-brand-600 hover:underline">
          ← All resumes
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          {resume.versionName}
          {isBase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              ★ Base Resume
            </span>
          )}
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
        isBase={isBase}
      />
    </div>
  );
}
