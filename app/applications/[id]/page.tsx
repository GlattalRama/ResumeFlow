import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getItem, readAll, readByApplication } from "@/lib/store";
import { resolveBaseResumeId } from "@/lib/baseResume";
import { Card, StatusBadge } from "@/components/ui";
import StatusUpdater from "@/components/StatusUpdater";
import NotesSection from "@/components/NotesSection";
import DocumentsSection from "@/components/DocumentsSection";
import AiActions from "@/components/AiActions";
import TailorResumeFlow from "@/components/TailorResumeFlow";
import CoverLetterSection from "@/components/CoverLetterSection";
import ApplicationActions from "@/components/ApplicationActions";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, tStatus, locale] = await Promise.all([
    getTranslations("application"),
    getTranslations("status"),
    getLocale(),
  ]);
  const app = await getItem("applications", id);
  if (!app) notFound();

  const [notes, history, documents, resumes, baseResumeId] =
    await Promise.all([
      readByApplication("notes", id),
      readByApplication("statusHistory", id),
      readByApplication("documents", id),
      readAll("resumes"),
      resolveBaseResumeId(),
    ]);

  const resumeOptions = resumes.map((r) => ({
    id: r.id,
    label: `${r.versionName} (v${r.versionNumber})`,
  }));
  const linkedResume = resumes.find((r) => r.id === app.resumeVersionUsed);
  // Tailoring source default: Base Resume → linked version → none (force pick).
  const defaultSourceId =
    baseResumeId ?? (linkedResume ? linkedResume.id : "");

  const sortedHistory = [...history].sort((a, b) =>
    b.changedAt.localeCompare(a.changedAt)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/applications"
            className="text-sm text-brand-600 dark:text-brand-300 hover:underline"
          >
            ← {t("detail.allApplications")}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {app.jobTitle || t("detail.untitledRole")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {app.company || t("detail.unknownCompany")}
            {app.jobId ? ` · ${t("detail.jobId", { id: app.jobId })}` : ""}
          </p>
          <div className="mt-2">
            <StatusBadge status={app.status} />
          </div>
        </div>
        <ApplicationActions id={app.id} />
      </div>

      {/* Overview */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">{t("detail.overview")}</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label={t("detail.appliedDate")} value={app.appliedDate || "—"} />
          <Row
            label={t("detail.nextAction")}
            value={
              app.nextAction
                ? `${app.nextAction}${
                    app.nextActionDate ? ` (${app.nextActionDate})` : ""
                  }`
                : "—"
            }
          />
          <Row
            label={t("detail.resumeVersion")}
            value={
              linkedResume ? (
                <Link
                  href={`/resumes/${linkedResume.id}`}
                  className="text-brand-600 dark:text-brand-300 hover:underline"
                >
                  {linkedResume.versionName} (v{linkedResume.versionNumber})
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Row
            label={t("detail.jobLink")}
            value={
              app.jobLink ? (
                <a
                  href={app.jobLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 dark:text-brand-300 hover:underline"
                >
                  {app.jobLink}
                </a>
              ) : (
                "—"
              )
            }
          />
        </dl>
        {app.jobDescription && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground">{t("detail.jobDescription")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">
              {app.jobDescription}
            </p>
          </div>
        )}
      </Card>

      {/* Status + history */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">{t("detail.status")}</h2>
        <StatusUpdater applicationId={app.id} current={app.status} />
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("detail.statusHistory")}
          </p>
          <ol className="space-y-2 border-l-2 border-border pl-4">
            {sortedHistory.length === 0 && (
              <li className="text-sm text-muted-foreground/70">{t("detail.noHistory")}</li>
            )}
            {sortedHistory.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.30rem] top-1 h-2 w-2 rounded-full bg-brand-500" />
                <p className="text-sm text-foreground">
                  {h.oldStatus ? `${tStatus(h.oldStatus)} → ` : ""}
                  <span className="font-medium">{tStatus(h.newStatus)}</span>
                </p>
                {h.comment && (
                  <p className="text-xs text-muted-foreground">{h.comment}</p>
                )}
                <p className="text-[11px] text-muted-foreground/70">
                  {new Date(h.changedAt).toLocaleString(locale)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* AI assistant */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">
          {t("detail.aiAssistant")}
        </h2>
        <div className="mb-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {t("detail.tailoredResume")}
          </p>
          <TailorResumeFlow
            applicationId={app.id}
            resumeOptions={resumeOptions}
            defaultSourceId={defaultSourceId}
          />
        </div>
        <AiActions applicationId={app.id} />
      </Card>

      {/* Cover letter */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">
          {t("detail.coverLetter")}
        </h2>
        <CoverLetterSection
          applicationId={app.id}
          company={app.company}
          initialLetter={app.coverLetter ?? ""}
          initialMeta={app.coverLetterMeta ?? null}
          resumeOptions={resumeOptions}
          defaultSourceId={defaultSourceId}
        />
      </Card>

      {/* Interview Coach link */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground/80">
              {t("detail.interviewCoach")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("detail.interviewCoachHint")}
            </p>
          </div>
          <Link
            href={`/interview-coach?application=${app.id}`}
            className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("detail.prepareInterview")}
          </Link>
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">{t("detail.notes")}</h2>
        <NotesSection applicationId={app.id} notes={notes} />
      </Card>

      {/* Documents */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">{t("detail.documents")}</h2>
        <DocumentsSection
          applicationId={app.id}
          documents={documents}
          resumeOptions={resumeOptions}
        />
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground sm:w-28">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
