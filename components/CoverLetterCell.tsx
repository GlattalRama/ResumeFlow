"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// The "Cover letter" cell of the tracker: the uploaded letter that was sent
// (PDF / Word / text, stored as a "Cover Letter" document), else the letter
// written in the app (viewable as PDF), else an upload button and a link to
// write one.
export default function CoverLetterCell({
  applicationId,
  sentFile,
  hasSavedLetter,
}: {
  applicationId: string;
  sentFile: { id: string; name: string } | null;
  hasSavedLetter: boolean;
}) {
  const t = useTranslations("applications");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkCls = "text-brand-600 dark:text-brand-300 hover:underline";
  const actionCls =
    "inline-flex items-center gap-1 rounded-md border border-input bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground/80 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60 dark:hover:bg-brand-500/10";

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("applicationId", applicationId);
      form.set("type", "Cover Letter");
      form.set("name", file.name);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("uploadFailed"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
      ) : hasSavedLetter ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <Link href={`/applications/${applicationId}#cover-letter`} className={`truncate ${linkCls}`}>
            {t("generatedLetter")}
          </Link>
          <a
            href={`/api/applications/${applicationId}/cover-letter/pdf`}
            target="_blank"
            rel="noreferrer"
            className={`shrink-0 text-xs ${linkCls}`}
          >
            {t("viewPdf")}
          </a>
        </span>
      ) : null}

      <span className="flex flex-wrap items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={actionCls}
          title={t("uploadLetter")}
        >
          <span aria-hidden>⬆</span>
          {busy ? t("uploading") : sentFile ? t("replaceSent") : t("uploadLetter")}
        </button>
        {!sentFile && !hasSavedLetter && (
          <Link href={`/applications/${applicationId}#cover-letter`} className={`text-[11px] ${linkCls}`}>
            {t("writeLetter")}
          </Link>
        )}
      </span>
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
