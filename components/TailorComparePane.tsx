"use client";

import { useEffect, useRef } from "react";
import type {
  ResumeData,
  ResumeSectionState,
  TemplateStyleSettings,
} from "@/lib/types";
import { normalizeTemplateId, resolveTemplateStyle } from "@/lib/constants";
import A4Preview from "./A4Preview";
import ResumeTemplateRenderer from "./ResumeTemplateRenderer";

// Side-by-side sheet compare for the tailoring review: the original and the
// (choice-applied) tailored resume rendered with the same template/styling.
// Accepted changes are outlined green on the tailored sheet via the
// data-rf-section / data-rf-item tags the templates already carry.
export default function TailorComparePane({
  source,
  tailored,
  selectedTemplate,
  templateStyle,
  sectionState,
  changedKeys,
  labelLeft = "Original",
  labelRight = "Tailored — accepted changes outlined",
}: {
  source: ResumeData;
  tailored: ResumeData;
  selectedTemplate: string;
  templateStyle?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
  changedKeys: string[];
  labelLeft?: string;
  labelRight?: string;
}) {
  const tailoredRef = useRef<HTMLDivElement>(null);
  const template = normalizeTemplateId(selectedTemplate);
  const margins = resolveTemplateStyle(templateStyle).pageMargins;

  // Mark accepted-change regions on the tailored sheet. No dependency array:
  // the page slices' DOM is recreated as content/pagination changes, so
  // re-apply after every render (cheap queries, small DOM).
  useEffect(() => {
    const root = tailoredRef.current;
    if (!root) return;
    root
      .querySelectorAll<HTMLElement>(".rf-changed")
      .forEach((el) => el.classList.remove("rf-changed"));
    const mark = (selector: string) =>
      root
        .querySelectorAll<HTMLElement>(`.a4-screen-pages ${selector}`)
        .forEach((el) => el.classList.add("rf-changed"));
    for (const key of changedKeys) {
      if (key === "summary") mark(`[data-rf-section="summary"]`);
      else if (key.startsWith("exp:"))
        mark(
          `[data-rf-section="experience"] [data-rf-item="${key.slice(4)}"]`
        );
      else if (key === "areas") mark(`[data-rf-section="areas"]`);
      // "skills" and "skillCategories" both render in the skills section.
      else mark(`[data-rf-section="skills"]`);
    }
  });

  const pane = (
    label: string,
    data: ResumeData,
    ref?: React.RefObject<HTMLDivElement | null>
  ) => (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
        {label}
      </p>
      <div
        ref={ref}
        className="rf-compare rounded-lg border border-border bg-muted p-2"
      >
        <A4Preview margins={margins}>
          <ResumeTemplateRenderer
            resumeData={data}
            selectedTemplate={template}
            style={templateStyle}
            sectionState={sectionState}
            atsSafe={false}
          />
        </A4Preview>
      </div>
    </div>
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {pane(labelLeft, source)}
      {pane(labelRight, tailored, tailoredRef)}
    </div>
  );
}
