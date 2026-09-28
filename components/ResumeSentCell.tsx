"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// The "Resume sent" cell of the tracker, with its actions inline: upload the
// file that was actually sent (stored as a Resume document on the application)
// or link one of the saved versions. Shows the uploaded file first, else the
// linked version with its generated PDF, else the actions alone.
export default function ResumeSentCell({
  applicationId,
  sentFile,
  resume,
  resumeOptions,
}: {
  applicationId: string;
  sentFile: { id: string; name: string } | null;
  resume: { id: string; versionName: string; versionNumber: number } | null;
  resumeOptions: { id: string; label: string }[];
}) {
  const t = useTranslations("applications");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linkCls = "text-brand-600 dark:text-brand-300 hover:underline";
  const actionCls =
    "inline-flex items-center gap-1 rounded-md border border-input bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground/80 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60 dark:hover:bg-brand-500/10";

  async function upload(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("applicationId", applicationId);
      form.set("type", "Resume");
      form.set("name", file.name);
      if (resume) form.set("resumeVersionId", resume.id);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("uploadFailed"));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function linkVersion(id: string) {
    if (!id) return;
    setBusy("link");
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeVersionUsed: id }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setBusy(null);
    }
  }

  const uploadButton = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => fileRef.current?.click()}
        className={actionCls}
        title={t("uploadSent")}
      >
        <span aria-hidden>⬆</span>
        {busy === "upload" ? t("uploading") : sentFile ? t("replaceSent") : t("uploadSent")}
      </button>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      {sentFile ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <a
            href={`/api/documents/${sentFile.id}/file`}
            target="_blank"
            rel="noreferrer"
            className={`truncate font-medium ${linkCls}`}
            title={sentFile.name}
          >
            {sentFile.name}
          </a>
          <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-700 dark:bg-green-950 dark:text-green-300">
            {t("sent")}
          </span>
        </span>
      ) : resume ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <Link href={`/resumes/${resume.id}`} className={`truncate ${linkCls}`} title={resume.versionName}>
            {resume.versionName}
          </Link>
          <span className="shrink-0 text-xs text-muted-foreground">v{resume.versionNumber}</span>
          <a href={`/api/resumes/${resume.id}/pdf`} target="_blank" rel="noreferrer" className={`shrink-0 text-xs ${linkCls}`}>
            {t("viewPdf")}
          </a>
        </span>
      ) : null}

      <span className="flex flex-wrap items-center gap-1.5">
        {uploadButton}
        {!sentFile && (
          <select
            value=""
            disabled={busy !== null || resumeOptions.length === 0}
            aria-label={t("linkVersion")}
            onChange={(e) => void linkVersion(e.target.value)}
            className={`${actionCls} max-w-[11rem] cursor-pointer pr-1`}
          >
            <option value="">
              {busy === "link" ? t("uploading") : resume ? t("changeVersion") : t("linkVersion")}
            </option>
            {resumeOptions
              .filter((o) => o.id !== resume?.id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
          </select>
        )}
      </span>
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
