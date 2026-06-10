"use client";

import { useState } from "react";
import type {
  ResumeData,
  ResumeSectionState,
  TemplateId,
  TemplateStyleSettings,
} from "@/lib/types";
import { resolveTemplateStyle } from "@/lib/constants";
import A4Preview from "./A4Preview";
import ResumeTemplateRenderer from "./ResumeTemplateRenderer";
import ResumePreviewActions from "./ResumePreviewActions";

// Client wrapper for the resume preview page. Owns the "ATS-safe" toggle so the
// same flag drives the on-screen preview, the PDF (printed from this DOM) and
// the DOCX export (passed down to the actions).
export default function ResumePreviewPane({
  id,
  resumeData,
  selectedTemplate,
  templateStyle,
  sectionState,
  isBase = false,
  baseSet = false,
}: {
  id: string;
  resumeData: ResumeData;
  selectedTemplate: TemplateId;
  templateStyle?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
  isBase?: boolean;
  baseSet?: boolean;
}) {
  const [atsSafe, setAtsSafe] = useState(false);
  const margins = resolveTemplateStyle(templateStyle).pageMargins;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={atsSafe}
            onChange={(e) => setAtsSafe(e.target.checked)}
            className="h-4 w-4"
          />
          ATS-safe mode
          <span className="font-normal text-gray-400">
            (single column, no photo — affects preview, PDF &amp; DOCX)
          </span>
        </label>
        <ResumePreviewActions
          id={id}
          resumeData={resumeData}
          templateStyle={templateStyle}
          sectionState={sectionState}
          atsSafe={atsSafe}
          isBase={isBase}
          baseSet={baseSet}
        />
      </div>

      <div className="mx-auto max-w-4xl">
        <div className="print-area rounded-xl bg-gray-100 p-4 print:bg-white print:p-0">
          <A4Preview margins={margins}>
            <ResumeTemplateRenderer
              resumeData={resumeData}
              selectedTemplate={selectedTemplate}
              style={templateStyle}
              sectionState={sectionState}
              atsSafe={atsSafe}
            />
          </A4Preview>
        </div>
      </div>
    </>
  );
}
