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
}: {
  id: string;
  resumeData: ResumeData;
  templateStyle?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
  // When true, DOCX/PDF exports use the ATS-safe layout. The PDF (window.print)
  // prints the currently-rendered preview, so it follows the same toggle.
  atsSafe?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pptx" | null>(null);

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
    if (!confirm("Delete this resume version? This cannot be undone.")) return;
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
        onClick={() => window.print()}
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
