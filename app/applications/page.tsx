import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { readAll } from "@/lib/store";
import type { Application, DocumentMeta, ResumeVersion } from "@/lib/types";
import {
  STAGES,
  SORTS,
  isDue,
  isSortKey,
  isStage,
  monogram,
  relativeTime,
  sortApplications,
  stageOf,
  type SortKey,
  type Stage,
} from "@/lib/applicationStages";
import { EmptyState, PageHeader, buttonClass } from "@/components/ui";
import ApplicationStatusSelect from "@/components/ApplicationStatusSelect";
import ResumeSentCell from "@/components/ResumeSentCell";

export const dynamic = "force-dynamic";

// Applications tracker: pipeline tabs with counts, a sortable table, and — the
// part a job board can't give you — the exact resume that went out with each
// application (the uploaded file, or the app-generated PDF of the linked
// version), plus next actions with overdue highlighting.
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; sort?: string }>;
}) {
  const [{ stage: stageParam, sort: sortParam }, t, locale] = await Promise.all([
    searchParams,
    getTranslations("applications"),
    getLocale(),
  ]);
  const stage: Stage = isStage(stageParam) ? stageParam : "all";
  const sort: SortKey = isSortKey(sortParam) ? sortParam : "updated";

  const [apps, resumes, documents, notes] = await Promise.all([
    readAll("applications"),
    readAll("resumes"),
    readAll("documents"),
    readAll("notes"),
  ]);

  const resumeById = new Map(resumes.map((r) => [r.id, r]));
  const resumeOptions = [...resumes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((r) => ({ id: r.id, label: `${r.versionName} (v${r.versionNumber})` }));
  // Newest uploaded resume file per application.
  const sentFileByApp = new Map<string, DocumentMeta>();
  for (const d of [...documents].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (d.type === "Resume" && (d.driveFileId || d.dataUrl)) sentFileByApp.set(d.applicationId, d);
  }
  const noteCount = new Map<string, number>();
  for (const n of notes) noteCount.set(n.applicationId, (noteCount.get(n.applicationId) ?? 0) + 1);

  const counts: Record<Stage, number> = { all: apps.length, saved: 0, applied: 0, interviewing: 0, offer: 0, archived: 0 };
  for (const a of apps) counts[stageOf(a.status)]++;
  const visible = sortApplications(
    stage === "all" ? apps : apps.filter((a) => stageOf(a.status) === stage),
    sort
  );
  const dueCount = apps.filter((a) => stageOf(a.status) !== "archived" && isDue(a.nextActionDate)).length;

  const href = (s: Stage, k: SortKey) =>
    `/applications?${new URLSearchParams({ ...(s !== "all" ? { stage: s } : {}), ...(k !== "updated" ? { sort: k } : {}) })}`;

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={dueCount > 0 ? t("dueSubtitle", { count: dueCount }) : t("subtitle")}
        action={
          <Link href="/applications/new" className={buttonClass("primary")}>
            {t("new")}
          </Link>
        }
      />

      {apps.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          hint={t("emptyHint")}
          cta={{ href: "/applications/new", label: t("add") }}
        />
      ) : (
        <>
          {/* Stage tabs + sort */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav className="flex flex-wrap gap-2" aria-label={t("stagesLabel")}>
              {STAGES.map((s) => {
                const active = s === stage;
                return (
                  <Link
                    key={s}
                    href={href(s, sort)}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-input bg-card text-foreground/80 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                    }`}
                  >
                    {t(`stages.${s}`)}
                    <span className={`text-xs ${active ? "text-white/80" : "text-muted-foreground"}`}>
                      {counts[s]}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{t("sortBy")}</span>
              {SORTS.map((k) => (
                <Link
                  key={k}
                  href={href(stage, k)}
                  className={`rounded-md px-2 py-1 transition ${
                    k === sort ? "bg-muted font-semibold text-foreground" : "hover:bg-muted/60"
                  }`}
                >
                  {t(`sorts.${k}`)}
                </Link>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {t("noneInStage", { stage: t(`stages.${stage}`) })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {/* Header (desktop) */}
              <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_auto_minmax(0,1.3fr)_auto] gap-4 border-b border-border bg-muted/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <span>{t("columns.job")}</span>
                <span>{t("columns.resume")}</span>
                <span>{t("columns.status")}</span>
                <span>{t("columns.nextAction")}</span>
                <span className="text-right">{t("columns.updated")}</span>
              </div>
              <ul className="divide-y divide-border">
                {visible.map((a) => (
                  <ApplicationRow
                    key={a.id}
                    app={a}
                    resume={a.resumeVersionUsed ? resumeById.get(a.resumeVersionUsed) : undefined}
                    sentFile={sentFileByApp.get(a.id)}
                    notes={noteCount.get(a.id) ?? 0}
                    resumeOptions={resumeOptions}
                    locale={locale}
                    t={t}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ApplicationRow({
  app,
  resume,
  sentFile,
  notes,
  resumeOptions,
  locale,
  t,
}: {
  app: Application;
  resume?: ResumeVersion;
  sentFile?: DocumentMeta;
  notes: number;
  resumeOptions: { id: string; label: string }[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"applications">>>;
}) {
  const { initials, hue } = monogram(app.company || app.jobTitle || "?");
  const archived = stageOf(app.status) === "archived";
  const due = !archived && isDue(app.nextActionDate);
  const applied = app.appliedDate ? relativeTime(app.appliedDate, locale) : "";

  return (
    <li
      className={`grid grid-cols-1 gap-2 px-4 py-3 transition hover:bg-muted/40 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_auto_minmax(0,1.3fr)_auto] md:items-center md:gap-4 ${
        archived ? "opacity-70" : ""
      }`}
    >
      {/* Job */}
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: `hsl(${hue} 45% 45%)` }}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <Link href={`/applications/${app.id}`} className="block truncate font-semibold text-foreground hover:underline">
            {app.jobTitle || t("untitledRole")}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {app.company || t("unknownCompany")}
            {app.jobId ? ` · ${t("jobId", { id: app.jobId })}` : ""}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground/80">
            {applied ? <span>{t("appliedRelative", { when: applied })}</span> : <span>{t("notAppliedYet")}</span>}
            {app.coverLetter?.trim() && <span title={t("hasCoverLetter")}>✉ {t("coverLetterShort")}</span>}
            {notes > 0 && <span>✎ {t("notesCount", { count: notes })}</span>}
          </p>
        </div>
      </div>

      {/* Resume sent — with inline upload / link-a-version actions */}
      <div className="min-w-0">
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
          {t("columns.resume")}
        </span>
        <ResumeSentCell
          applicationId={app.id}
          sentFile={sentFile ? { id: sentFile.id, name: sentFile.name } : null}
          resume={
            resume
              ? { id: resume.id, versionName: resume.versionName, versionNumber: resume.versionNumber }
              : null
          }
          resumeOptions={resumeOptions}
        />
      </div>

      {/* Status — change it right here */}
      <div>
        <ApplicationStatusSelect
          applicationId={app.id}
          status={app.status}
          appliedDate={app.appliedDate}
        />
      </div>

      {/* Next action */}
      <div className="min-w-0 text-xs">
        {app.nextAction ? (
          <p className={`truncate ${due ? "font-medium text-red-600 dark:text-red-400" : "text-foreground/80"}`} title={app.nextAction}>
            {due ? "⚑ " : ""}
            {app.nextAction}
            {app.nextActionDate && (
              <span className={due ? "" : "text-muted-foreground"}> · {relativeTime(app.nextActionDate, locale)}</span>
            )}
          </p>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </div>

      {/* Updated */}
      <p className="text-xs text-muted-foreground md:text-right" title={new Date(app.updatedAt).toLocaleString(locale)}>
        {relativeTime(app.updatedAt, locale)}
      </p>
    </li>
  );
}
