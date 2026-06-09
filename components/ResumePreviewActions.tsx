"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
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
}) {
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
    // The Base Resume is the user's clean master copy — require a stronger,
    // two-step confirmation before deleting it (and note the base is cleared).
    if (isBase) {
      if (
        !confirm(
          "This is your BASE RESUME — your clean master copy. Deleting it removes it and clears the Base Resume designation. This cannot be undone."
        )
      )
        return;
      if (
        !confirm(
          "Are you absolutely sure? You'll need to designate a new Base Resume afterward."
        )
      )
        return;
    } else if (
      !confirm("Delete this resume version? This cannot be undone.")
    ) {
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
      alert("DOCX export failed.");
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
      alert("PPTX export failed.");
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
        Download PDF
      </button>
      <button
        onClick={downloadDocx}
        disabled={exporting !== null}
        className={buttonClass("secondary")}
        type="button"
      >
        {exporting === "docx" ? "Preparing…" : "Download DOCX"}
      </button>
      <button
        onClick={downloadPptx}
        disabled={exporting !== null}
        className={buttonClass("secondary")}
        type="button"
      >
        {exporting === "pptx" ? "Preparing…" : "Download PPTX"}
      </button>
      <Link href={`/resumes/${id}/edit`} className={buttonClass("secondary")}>
        Edit
      </Link>
      <button
        onClick={duplicate}
        disabled={busy}
        className={buttonClass("secondary")}
        type="button"
      >
        Duplicate
      </button>
      {isBase ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
          ★ Base Resume
        </span>
      ) : (
        <button
          onClick={setBase}
          disabled={busy}
          className={buttonClass("secondary")}
          type="button"
        >
          Set as Base Resume
        </button>
      )}
      <button
        onClick={remove}
        disabled={busy}
        className={buttonClass("danger")}
        type="button"
      >
        Delete
      </button>
    </div>
  );
}
