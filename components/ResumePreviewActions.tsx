"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ResumeData,
  ResumeSectionState,
  TemplateStyleSettings,
} from "@/lib/types";
import { exportResumeDocx, exportResumePptx } from "@/lib/resumeExport";
import { buttonClass } from "./ui";

export default function ResumePreviewActions({
  id,
  resumeData,
  templateStyle,
  sectionState,
  atsSafe = false,
  isBase = false,
  baseSet = false,
}: {
  id: string;
  resumeData: ResumeData;
  templateStyle?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
  // When true, DOCX/PDF exports use the ATS-safe layout. The PDF (window.print)
  // prints the currently-rendered preview, so it follows the same toggle.
  atsSafe?: boolean;
  // Whether this version is the designated Base Resume.
  isBase?: boolean;
  // Whether ANY Base Resume is currently designated. Deletion is only allowed
  // once a base exists (and the base itself can't be deleted).
  baseSet?: boolean;
}) {
  const t = useTranslations("resumeDetail");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pptx" | null>(null);

  // Fire-and-forget aggregate export counter (no resume content sent).
  function reportExport(format: "pdf" | "docx" | "pptx") {
    void fetch("/api/analytics/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
      keepalive: true,
    }).catch(() => {});
  }

  async function setBase() {
    setBusy(true);
    try {
      const res = await fetch("/api/base-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    const res = await fetch(`/api/resumes/${id}`, { method: "POST" });
    if (res.ok) {
      const copy = await res.json();
      router.push(`/resumes/${copy.id}`);
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  async function remove() {
    // Deletion is gated on having a clean master copy to protect:
    //  - no Base Resume designated → the user must pick one first;
    //  - this version IS the base → it can't be deleted (pick a different base).
    // These mirror the server-side guard in /api/resumes/[id] DELETE.
    if (!baseSet) {
      alert(t("deleteNeedsBaseAlert"));
      return;
    }
    if (isBase) {
      alert(t("deleteBaseAlert"));
      return;
    }
    if (!confirm(t("deleteConfirm"))) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/resumes");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  async function downloadDocx() {
    setExporting("docx");
    try {
      await exportResumeDocx(resumeData, templateStyle, sectionState, atsSafe);
      reportExport("docx");
    } catch (e) {
      console.error(e);
      alert(t("docxExportFailed"));
    } finally {
      setExporting(null);
    }
  }

  async function downloadPptx() {
    setExporting("pptx");
    try {
      await exportResumePptx(resumeData, templateStyle, sectionState);
      reportExport("pptx");
    } catch (e) {
      console.error(e);
      alert(t("pptxExportFailed"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        onClick={() => {
          reportExport("pdf");
          window.print();
        }}
        className={buttonClass("primary")}
        type="button"
      >
        {t("downloadPdf")}
      </button>
      <button
        onClick={downloadDocx}
        disabled={exporting !== null}
        className={buttonClass("secondary")}
        type="button"
      >
        {exporting === "docx" ? t("preparing") : t("downloadDocx")}
      </button>
      <button
        onClick={downloadPptx}
        disabled={exporting !== null}
        className={buttonClass("secondary")}
        type="button"
      >
        {exporting === "pptx" ? t("preparing") : t("downloadPptx")}
      </button>
      <Link href={`/resumes/${id}/edit`} className={buttonClass("secondary")}>
        {t("edit")}
      </Link>
      <button
        onClick={duplicate}
        disabled={busy}
        className={buttonClass("secondary")}
        type="button"
      >
        {t("duplicate")}
      </button>
      {isBase ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900">
          ★ {t("baseResume")}
        </span>
      ) : (
        <button
          onClick={setBase}
          disabled={busy}
          className={buttonClass("secondary")}
          type="button"
        >
          {t("setAsBase")}
        </button>
      )}
      <button
        onClick={remove}
        disabled={busy}
        className={`${buttonClass("danger")}${
          !baseSet || isBase ? " opacity-50" : ""
        }`}
        title={
          !baseSet
            ? t("deleteNeedsBaseTitle")
            : isBase
            ? t("deleteBaseTitle")
            : undefined
        }
        type="button"
      >
        {t("delete")}
      </button>
    </div>
  );
}
