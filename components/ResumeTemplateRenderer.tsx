import type {
  ResumeData,
  ResumeSectionState,
  TemplateId,
  TemplateStyleSettings,
} from "@/lib/types";
import { normalizeTemplateId, resolveTemplateStyle } from "@/lib/constants";
import ModernTemplate from "./templates/ModernTemplate";
import ClassicTemplate from "./templates/ClassicTemplate";
import MinimalTemplate from "./templates/MinimalTemplate";
import CustomTemplate from "./templates/CustomTemplate";
import AtsCorporateTemplate from "./templates/AtsCorporateTemplate";

// Renders the correct template for the given resumeData + selectedTemplate.
// All templates consume the identical ResumeData shape and accept the same
// optional style settings (font + colors) and document `sectionState` (the
// user-chosen order + visibility of body sections). ATS Corporate Style is fully
// wired to honor every setting; the others at least apply the selected font.
export default function ResumeTemplateRenderer({
  resumeData,
  selectedTemplate,
  style,
  sectionState,
  atsSafe = false,
}: {
  resumeData: ResumeData;
  selectedTemplate: TemplateId;
  style?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
  // ATS-safe rendering (single column, no photo/icons). Honored by the ATS
  // Corporate Style template; other templates render unchanged.
  atsSafe?: boolean;
}) {
  const resolved = resolveTemplateStyle(style);
  const props = { data: resumeData, style: resolved, sectionState };
  switch (normalizeTemplateId(selectedTemplate)) {
    case "classic":
      return <ClassicTemplate {...props} />;
    case "minimal":
      return <MinimalTemplate {...props} />;
    case "custom":
      return <CustomTemplate {...props} />;
    case "ats-corporate":
      return <AtsCorporateTemplate {...props} atsSafe={atsSafe} />;
    case "modern":
    default:
      return <ModernTemplate {...props} />;
  }
}
