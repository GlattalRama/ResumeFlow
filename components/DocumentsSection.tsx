"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DocumentMeta } from "@/lib/types";

// Document type VALUES are data; only their display labels are localized.
const DOC_TYPES = ["Resume", "Cover Letter", "Portfolio", "Other"];

export default function DocumentsSection({
  applicationId,
  documents,
  resumeOptions,
}: {
  applicationId: string;
  documents: DocumentMeta[];
  resumeOptions: { id: string; label: string }[];
}) {
  const t = useTranslations("application");
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("Resume");
  const [link, setLink] = useState("");
  const [resumeVersionId, setResumeVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Add a document: with a chosen file it is uploaded (multipart), otherwise
  // only the metadata + link are stored, as before.
  async function add() {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!name.trim() && !file) return;
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        form.set("applicationId", applicationId);
        form.set("name", name.trim() || file.name);
        form.set("type", type);
        form.set("link", link);
        form.set("resumeVersionId", resumeVersionId);
        res = await fetch("/api/documents", { method: "POST", body: form });
      } else {
        res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId, name, type, link, resumeVersionId }),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("docs.uploadFailed"));
        return;
      }
      setName("");
      setLink("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError(t("docs.uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function resumeLabel(id: string) {
    return resumeOptions.find((r) => r.id === id)?.label;
  }

  function docTypeLabel(docType: string) {
    return DOC_TYPES.includes(docType) ? t(`docType.${docType}`) : docType;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground/70">
        {t("docs.uploadHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-label={t("docs.upload")}
          className="min-w-[12rem] flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
        />
        <input
          className="min-w-[10rem] flex-1 rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
          placeholder={t("docs.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="rounded-md border border-input bg-card text-foreground px-2 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {DOC_TYPES.map((docType) => (
            <option key={docType} value={docType}>
              {docTypeLabel(docType)}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-input bg-card text-foreground px-2 py-2 text-sm"
          value={resumeVersionId}
          onChange={(e) => setResumeVersionId(e.target.value)}
        >
          <option value="">{t("docs.resumeVersionOption")}</option>
          {resumeOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          className="min-w-[10rem] flex-1 rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
          placeholder={t("docs.linkPlaceholder")}
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? t("docs.uploading") : t("docs.add")}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <ul className="mt-4 space-y-2">
        {documents.length === 0 && (
          <li className="text-sm text-muted-foreground/70">{t("docs.empty")}</li>
        )}
        {documents.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3"
          >
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {docTypeLabel(d.type)}
              </span>
              <span className="text-sm text-foreground">{d.name}</span>
              {d.resumeVersionId && resumeLabel(d.resumeVersionId) && (
                <span className="ml-2 text-xs text-muted-foreground/70">
                  · {resumeLabel(d.resumeVersionId)}
                </span>
              )}
              {(d.driveFileId || d.dataUrl || d.mimeType) && (
                <a
                  href={`/api/documents/${d.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-xs text-brand-600 dark:text-brand-300 hover:underline"
                >
                  {t("docs.view")}
                </a>
              )}
              {d.link && (
                <a
                  href={d.link}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-xs text-brand-600 dark:text-brand-300 hover:underline"
                >
                  {t("docs.open")}
                </a>
              )}
            </div>
            <button
              onClick={() => remove(d.id)}
              className="shrink-0 text-xs text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400"
            >
              {t("docs.delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
