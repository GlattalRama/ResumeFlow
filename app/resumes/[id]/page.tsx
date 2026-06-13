import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getItem } from "@/lib/store";
import { TEMPLATES, normalizeTemplateId } from "@/lib/constants";
import { resolveBaseResumeId, isBaseResume } from "@/lib/baseResume";
import { listSnapshots } from "@/lib/resumeHistory";
import ResumePreviewPane from "@/components/ResumePreviewPane";
import HistorySection from "@/components/HistorySection";

export const dynamic = "force-dynamic";

export default async function ResumePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("resumeDetail");
  const [resume, baseResumeId, snapshots] = await Promise.all([
    getItem("resumes", id),
    resolveBaseResumeId(),
    listSnapshots(id),
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
        <Link href="/resumes" className="text-sm text-brand-600 dark:text-brand-300 hover:underline">
          ← {t("allResumes")}
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          {resume.versionName}
          {isBase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900">
              ★ {t("baseResume")}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          v{resume.versionNumber}
          {resume.targetRole ? ` · ${resume.targetRole}` : ""} · {t("templateLabel")}{" "}
          <span className="font-medium text-foreground/80">{templateName}</span>
        </p>
      </div>

      <ResumePreviewPane
        id={resume.id}
        resumeData={resume.resumeData}
        selectedTemplate={resume.selectedTemplate}
        templateStyle={resume.templateStyle}
        sectionState={resume.sectionState}
        isBase={isBase}
        baseSet={baseResumeId !== null}
      />

      <HistorySection resume={resume} snapshots={snapshots} />
    </div>
  );
}
