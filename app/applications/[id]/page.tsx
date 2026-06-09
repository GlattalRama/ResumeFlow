import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem, readAll, readByApplication } from "@/lib/store";
import { resolveBaseResumeId } from "@/lib/baseResume";
import { Card, StatusBadge } from "@/components/ui";
import StatusUpdater from "@/components/StatusUpdater";
import NotesSection from "@/components/NotesSection";
import DocumentsSection from "@/components/DocumentsSection";
import AiActions from "@/components/AiActions";
import TailorResumeFlow from "@/components/TailorResumeFlow";
import ApplicationActions from "@/components/ApplicationActions";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getItem("applications", id);
  if (!app) notFound();

  const [notes, history, documents, qna, resumes, baseResumeId] =
    await Promise.all([
      readByApplication("notes", id),
      readByApplication("statusHistory", id),
      readByApplication("documents", id),
      readByApplication("qna", id),
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
            className="text-sm text-brand-600 hover:underline"
          >
            ← All applications
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            {app.jobTitle || "Untitled role"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {app.company || "Unknown company"}
            {app.jobId ? ` · Job ID ${app.jobId}` : ""}
          </p>
          <div className="mt-2">
            <StatusBadge status={app.status} />
          </div>
        </div>
        <ApplicationActions id={app.id} />
      </div>

      {/* Overview */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Overview</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Applied date" value={app.appliedDate || "—"} />
          <Row
            label="Next action"
            value={
              app.nextAction
                ? `${app.nextAction}${
                    app.nextActionDate ? ` (${app.nextActionDate})` : ""
                  }`
                : "—"
            }
          />
          <Row
            label="Resume version"
            value={
              linkedResume ? (
                <Link
                  href={`/resumes/${linkedResume.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {linkedResume.versionName} (v{linkedResume.versionNumber})
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Job link"
            value={
              app.jobLink ? (
                <a
                  href={app.jobLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
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
            <p className="text-xs font-medium text-gray-500">Job description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
              {app.jobDescription}
            </p>
          </div>
        )}
      </Card>

      {/* Status + history */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Status</h2>
        <StatusUpdater applicationId={app.id} current={app.status} />
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-500">
            Status history
          </p>
          <ol className="space-y-2 border-l-2 border-gray-100 pl-4">
            {sortedHistory.length === 0 && (
              <li className="text-sm text-gray-400">No history yet.</li>
            )}
            {sortedHistory.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.30rem] top-1 h-2 w-2 rounded-full bg-brand-500" />
                <p className="text-sm text-gray-800">
                  {h.oldStatus ? `${h.oldStatus} → ` : ""}
                  <span className="font-medium">{h.newStatus}</span>
                </p>
                {h.comment && (
                  <p className="text-xs text-gray-500">{h.comment}</p>
                )}
                <p className="text-[11px] text-gray-400">
                  {new Date(h.changedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* AI assistant */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          AI assistant
        </h2>
        <div className="mb-4">
          <p className="mb-1 text-xs font-medium text-gray-500">
            Tailored resume
          </p>
          <TailorResumeFlow
            applicationId={app.id}
            resumeOptions={resumeOptions}
            defaultSourceId={defaultSourceId}
          />
        </div>
        <AiActions applicationId={app.id} />
      </Card>

      {/* Interview prep link */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              Interview preparation
            </h2>
            <p className="text-xs text-gray-500">
              {qna.length} question{qna.length === 1 ? "" : "s"} prepared
            </p>
          </div>
          <Link
            href={`/interview-prep/${app.id}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open prep →
          </Link>
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Notes</h2>
        <NotesSection applicationId={app.id} notes={notes} />
      </Card>

      {/* Documents */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Documents</h2>
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
      <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
