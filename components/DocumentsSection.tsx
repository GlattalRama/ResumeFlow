"use client";

import { useState } from "react";
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

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        name,
        type,
        link,
        resumeVersionId,
      }),
    });
    if (res.ok) {
      setName("");
      setLink("");
      router.refresh();
    }
    setBusy(false);
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
        {t("docs.metaOnly")}
      </p>
      <div className="flex flex-wrap gap-2">
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
          {t("docs.add")}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {documents.length === 0 && (
          <li className="text-sm text-muted-foreground/70">{t("docs.empty")}</li>
        )}
        {documents.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3"
          >
            <div>
              <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {docTypeLabel(d.type)}
              </span>
              <span className="text-sm text-foreground">{d.name}</span>
              {d.resumeVersionId && resumeLabel(d.resumeVersionId) && (
                <span className="ml-2 text-xs text-muted-foreground/70">
                  · {resumeLabel(d.resumeVersionId)}
                </span>
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
              className="text-xs text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400"
            >
              {t("docs.delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
