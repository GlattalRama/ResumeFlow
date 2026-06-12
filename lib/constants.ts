import type {
  ApplicationStatus,
  CustomSection,
  CustomSectionItem,
  CustomSectionLayoutType,
  DocSectionEntry,
  ResumeBulletStyle,
  ResumeData,
  ResumeFormCardState,
  ResumeSectionId,
  ResumeSectionState,
  TemplateId,
  TemplateMeta,
  TemplateStyleSettings,
} from "./types";

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "modern",
    name: "Modern",
    description: "Accent sidebar header, bold name, clean section rules.",
    hidden: true,
  },
  {
    id: "classic",
    name: "Classic",
    description: "Traditional serif, centered header, timeless layout.",
    hidden: true,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Lots of whitespace, light type, understated.",
    hidden: true,
  },
  {
    id: "custom",
    name: "Custom",
    description: "Two-column accented layout with skill chips.",
    hidden: true,
  },
  {
    id: "ats-corporate",
    name: "ATS Corporate Style",
    description: "ATS-friendly, single column, plain headings.",
  },
  {
    id: "cognizant",
    name: "Cognizant Corporate",
    description:
      "Branded corporate layout: logo header, blue section rules, two-column expertise, projects page.",
    hidden: true,
  },
];

export const TEMPLATE_IDS: TemplateId[] = TEMPLATES.map((t) => t.id);

// Templates offered in the picker (hidden ones are kept in TEMPLATES so existing
// resumes still render and show their name, but are not selectable for now).
export const VISIBLE_TEMPLATES: TemplateMeta[] = TEMPLATES.filter(
  (t) => !t.hidden
);

// Default template for new resume versions: the first visible template.
export const DEFAULT_TEMPLATE_ID: TemplateId =
  VISIBLE_TEMPLATES[0]?.id ?? "ats-corporate";

// Effective visibility of a template given the admin overrides map. A present
// boolean override wins; otherwise fall back to the hardcoded `hidden` default.
export function isTemplateVisible(
  meta: TemplateMeta,
  overrides?: Record<string, boolean> | null
): boolean {
  const override = overrides?.[meta.id];
  if (typeof override === "boolean") return override;
  return !meta.hidden;
}

// The templates offered in the picker after applying the admin overrides. Used
// by the resume builder so admins can enable/disable hidden templates without a
// code change; falls back to VISIBLE_TEMPLATES when no overrides are passed.
export function resolveVisibleTemplates(
  overrides?: Record<string, boolean> | null
): TemplateMeta[] {
  if (!overrides) return VISIBLE_TEMPLATES;
  return TEMPLATES.filter((t) => isTemplateVisible(t, overrides));
}

export function isTemplateId(value: string): value is TemplateId {
  return TEMPLATE_IDS.includes(value as TemplateId);
}

// Legacy template ids that have since been renamed. Existing saved resumes may
// still store these, so we map them to the current id when loading/displaying.
const LEGACY_TEMPLATE_IDS: Record<string, TemplateId> = {
  cts: "ats-corporate",
};

// Normalizes a stored template id: applies legacy renames and falls back to
// "modern" for anything unrecognized.
export function normalizeTemplateId(value: string | null | undefined): TemplateId {
  if (value && value in LEGACY_TEMPLATE_IDS) return LEGACY_TEMPLATE_IDS[value];
  if (value && isTemplateId(value)) return value;
  return "modern";
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Saved",
  "Applied",
  "Phone Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

export const STATUS_STYLES: Record<ApplicationStatus, string> = {
  Saved: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  Applied: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  "Phone Screen": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  Interview: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
  Offer: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  Rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  Withdrawn: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

export const NOTE_TYPES = ["general", "recruiter", "interview", "todo"] as const;
export const QNA_DIFFICULTIES = ["easy", "medium", "hard"] as const;

// ---- Template style customization ----

// Font choices offered in the resume builder. `value` is a CSS font-family
// stack (used in the live preview); `docx`/`pptx` map to a single family name
// understood by the Word / PowerPoint exporters.
export const FONT_OPTIONS: {
  label: string;
  value: string;
  exportName: string;
}[] = [
  {
    label: "Sans (Arial / Helvetica)",
    value: "Arial, Helvetica, sans-serif",
    exportName: "Arial",
  },
  {
    label: "Calibri",
    value: "Calibri, 'Segoe UI', sans-serif",
    exportName: "Calibri",
  },
  {
    label: "Georgia (serif)",
    value: "Georgia, 'Times New Roman', serif",
    exportName: "Georgia",
  },
  {
    label: "Times New Roman (serif)",
    value: "'Times New Roman', Times, serif",
    exportName: "Times New Roman",
  },
  {
    label: "Garamond (serif)",
    value: "Garamond, 'Times New Roman', serif",
    exportName: "Garamond",
  },
];

// Default name / heading size multipliers (× the base body size). These match
// the ATS Corporate Style template's original visual proportions and are also the reference the
// DOCX/PPTX exporters scale against. Exported so every output stays in sync.
export const DEFAULT_FONT_SCALE = { name: 1.85, heading: 1.08 };

// Default style settings. These reproduce the ATS Corporate Style template's original look
// (black headings/body, plain section rules) so existing resumes render
// unchanged until a user customizes them.
export function defaultTemplateStyle(): TemplateStyleSettings {
  return {
    fontFamily: FONT_OPTIONS[0].value,
    fontSize: 13,
    fontScale: { ...DEFAULT_FONT_SCALE },
    primaryColor: "#0033A0", // Cognizant blue

    bodyColor: "#1f2937",
    mutedColor: "#6b7280",
    sectionLineColor: "#111111",
    pageMargins: { top: 12, right: 12, bottom: 12, left: 12 },
    lineSpacing: { section: 1, text: 1.6, bullet: 0.15 },
  };
}

// Merge a (possibly partial / missing) saved style with defaults so renderers
// and exporters always receive a complete settings object.
export function resolveTemplateStyle(
  style?: Partial<TemplateStyleSettings> | null
): TemplateStyleSettings {
  return { ...defaultTemplateStyle(), ...(style ?? {}) };
}

// Map a CSS font-family stack back to the single family name the DOCX/PPTX
// exporters understand; falls back to the first option.
export function fontExportName(fontFamily: string): string {
  return (
    FONT_OPTIONS.find((f) => f.value === fontFamily)?.exportName ??
    FONT_OPTIONS[0].exportName
  );
}

export function emptyResumeData(): ResumeData {
  return {
    basics: {
      name: "",
      title: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      summary: "",
    },
    profilePhoto: "",
    profilePhotoMeta: null,
    areasOfExpertise: [],
    areasOfExpertiseBulletStyle: "bullet",
    experience: [],
    education: [],
    skills: [],
    skillCategories: [],
    projects: [],
    certifications: [],
    languages: [],
    customSections: [],
  };
}

// Backfill any missing arrays / basics on a (possibly legacy or partial)
// ResumeData so consumers can safely call .map/.join without guarding every
// field. Older records predate some fields (e.g. languages, areasOfExpertise,
// skillCategories, customSections) and store them as undefined; templates and
// exporters render the same shape, so normalize once at those entry points.
export function normalizeResumeData(data: ResumeData): ResumeData {
  const d = emptyResumeData();
  return {
    ...d,
    ...data,
    basics: { ...d.basics, ...(data.basics ?? {}) },
    areasOfExpertise: data.areasOfExpertise ?? d.areasOfExpertise,
    areasOfExpertiseBulletStyle:
      data.areasOfExpertiseBulletStyle ?? d.areasOfExpertiseBulletStyle,
    experience: data.experience ?? d.experience,
    education: data.education ?? d.education,
    skills: data.skills ?? d.skills,
    skillCategories: data.skillCategories ?? d.skillCategories,
    projects: data.projects ?? d.projects,
    certifications: data.certifications ?? d.certifications,
    languages: data.languages ?? d.languages,
    customSections: data.customSections ?? d.customSections,
  };
}

// ---- Areas of Expertise bullet styles ----

// Selectable marker styles for the Areas of Expertise list. `char` is the glyph
// used in the HTML preview and (where supported) the exporters.
export const BULLET_STYLE_OPTIONS: {
  value: ResumeBulletStyle;
  label: string;
  char: string;
}[] = [
  { value: "bullet", label: "Bullet •", char: "•" },
  { value: "dash", label: "Dash –", char: "–" },
  { value: "check", label: "Check ✓", char: "✓" },
  { value: "arrow", label: "Arrow →", char: "→" },
  { value: "none", label: "None", char: "" },
];

// The marker glyph for a bullet style; empty string for "none". Falls back to a
// disc bullet for unknown/missing values.
export function getBulletSymbol(style?: ResumeBulletStyle | null): string {
  return (
    BULLET_STYLE_OPTIONS.find((b) => b.value === style)?.char ??
    BULLET_STYLE_OPTIONS[0].char
  );
}

// Split a list into two balanced columns, filling the left column first:
// 10 items -> [5, 5], 9 items -> [5, 4]. Used to render Areas of Expertise as a
// balanced two-column layout in the preview and exports.
export function splitIntoBalancedColumns<T>(items: T[]): [T[], T[]] {
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

// ---- Resume builder form cards ----

// Canonical list of resume builder form cards, in their default order. Each
// card is collapsible and re-orderable; the chosen layout is persisted per
// resume version (ResumeVersion.formCardState).
export const RESUME_FORM_CARDS: { cardId: string; title: string }[] = [
  { cardId: "template", title: "Template" },
  { cardId: "style", title: "Font & Colors" },
  { cardId: "sections", title: "Document Sections" },
  { cardId: "version", title: "Version" },
  { cardId: "basics", title: "Basics" },
  { cardId: "summary", title: "Summary" },
  { cardId: "areas", title: "Areas of Expertise" },
  { cardId: "experience", title: "Work Experience" },
  { cardId: "education", title: "Education" },
  { cardId: "projects", title: "Projects" },
  { cardId: "skills", title: "Technical Skills" },
  { cardId: "certifications", title: "Certifications" },
  { cardId: "languages", title: "Languages" },
  { cardId: "customSections", title: "Custom Sections" },
];

// Merge a (possibly partial / missing) saved card layout with the canonical
// card list so the builder always renders every known card exactly once:
//   • saved collapsed/order is preserved for known cards,
//   • cards added since the layout was saved append at the end,
//   • cards that no longer exist are dropped,
//   • order is normalized to a clean 0..n-1 sequence.
export function resolveFormCardState(
  saved?: ResumeFormCardState[] | null
): ResumeFormCardState[] {
  const savedMap = new Map((saved ?? []).map((c) => [c.cardId, c]));
  const savedCount = saved?.length ?? 0;
  return RESUME_FORM_CARDS.map((card, i) => {
    const prev = savedMap.get(card.cardId);
    return {
      cardId: card.cardId,
      title: card.title, // always use the current title
      collapsed: prev?.collapsed ?? false,
      // Known cards keep their saved order; new cards append after the saved
      // ones (savedCount + canonical index) so they land at the end.
      order: prev?.order ?? savedCount + i,
    };
  })
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i }));
}

// ---- Resume document sections ----

// Canonical reorderable resume body sections, in their default order. This is
// the single source of truth for section identity + default ordering; the
// header (name/title/contact) is rendered first separately and is not listed.
export const RESUME_SECTIONS: { sectionId: ResumeSectionId; title: string }[] = [
  { sectionId: "summary", title: "Summary" },
  { sectionId: "areas", title: "Areas of Expertise" },
  { sectionId: "experience", title: "Work Experience" },
  { sectionId: "skills", title: "Technical Skills" },
  { sectionId: "projects", title: "Projects" },
  { sectionId: "education", title: "Education" },
  { sectionId: "certifications", title: "Certifications" },
  { sectionId: "languages", title: "Languages" },
];

// Merge a (possibly partial / missing) saved section layout with the canonical
// section list, mirroring resolveFormCardState:
//   • saved collapsed/visible/order is preserved for known sections,
//   • saved customTitle (the user's renamed label) is preserved,
//   • defaultTitle is always refreshed from the canonical list,
//   • sections added since the layout was saved append at the end (visible),
//   • sections that no longer exist are dropped,
//   • the result is sorted by order.
//
// Unlike resolveFormCardState, order is NOT reindexed to a clean 0..n-1
// sequence: default-section order values share one space with the custom
// sections' order (see `orderedDocSections`), so reindexing here would discard
// any interleaving of custom sections between defaults. The builder writes back
// a clean global sequence whenever the user reorders, so saved values stay tidy.
export function resolveSectionState(
  saved?: ResumeSectionState[] | null
): ResumeSectionState[] {
  const savedMap = new Map((saved ?? []).map((s) => [s.sectionId, s]));
  const savedCount = saved?.length ?? 0;
  return RESUME_SECTIONS.map((section, i) => {
    const prev = savedMap.get(section.sectionId);
    // Only keep a non-empty custom label; blank/whitespace falls back to default.
    const custom = prev?.customTitle?.trim();
    return {
      sectionId: section.sectionId,
      defaultTitle: section.title, // always use the current canonical title
      ...(custom ? { customTitle: custom } : {}),
      collapsed: prev?.collapsed ?? false,
      visible: prev?.visible ?? true,
      order: prev?.order ?? savedCount + i,
      pageBreakAfter: prev?.pageBreakAfter ?? false,
    };
  }).sort((a, b) => a.order - b.order);
}

// The label to render for a section: the user's custom title when set,
// otherwise the canonical default. Single source of truth for headings across
// the builder, preview, and every export.
export function sectionLabel(section: ResumeSectionState): string {
  const custom = section.customTitle?.trim();
  return custom ? custom : section.defaultTitle;
}

// Resolved heading label per section id (customTitle || defaultTitle), built
// from a (possibly partial / missing) saved layout. Templates and exporters
// look up section headings here so they never diverge.
export function resolveSectionLabels(
  saved?: ResumeSectionState[] | null
): Record<ResumeSectionId, string> {
  const out = {} as Record<ResumeSectionId, string>;
  for (const s of resolveSectionState(saved)) {
    out[s.sectionId] = sectionLabel(s);
  }
  return out;
}

// The Technical Skills rows as Category / Value pairs. Prefers the structured
// `skillCategories`; falls back to migrating the legacy flat `skills` list into
// value-only rows so resumes saved before this field still render.
export function resolveSkillCategories(data: ResumeData): CustomSectionItem[] {
  const cats = data.skillCategories ?? [];
  if (cats.length > 0) return cats;
  return (data.skills ?? []).map((value) => ({ category: "", value }));
}

// Whether a section has any content worth rendering. An empty section is hidden
// automatically even when `visible` is true.
export function sectionHasContent(
  data: ResumeData,
  sectionId: ResumeSectionId
): boolean {
  switch (sectionId) {
    case "summary":
      return Boolean(data.basics.summary?.trim());
    case "areas":
      return (data.areasOfExpertise ?? []).length > 0;
    case "experience":
      return data.experience.length > 0;
    case "skills":
      return resolveSkillCategories(data).some(
        (it) => it.category?.trim() || it.value?.trim()
      );
    case "projects":
      return data.projects.length > 0;
    case "education":
      return data.education.length > 0;
    case "certifications":
      return data.certifications.length > 0;
    case "languages":
      return (data.languages ?? []).length > 0;
  }
}

// THE one ordered section list. Returns the section ids to render, in the user's
// chosen order, filtered to those that are visible and non-empty. The preview,
// PDF, DOCX, and PPTX exports all consume this so they never diverge.
export function orderedVisibleSections(
  data: ResumeData,
  saved?: ResumeSectionState[] | null
): ResumeSectionId[] {
  return resolveSectionState(saved)
    .filter((s) => s.visible && sectionHasContent(data, s.sectionId))
    .map((s) => s.sectionId);
}

// ---- Custom resume sections ----

// Layout choices offered when creating/editing a custom section.
export const CUSTOM_LAYOUT_OPTIONS: {
  value: CustomSectionLayoutType;
  label: string;
}[] = [
  { value: "freeText", label: "Free Text" },
  { value: "bullets", label: "Bullets" },
  { value: "twoColumnBullets", label: "Two-Column Bullets" },
  { value: "categoryValue", label: "Category / Value" },
];

// The fallback heading for a custom section with no title yet.
export const CUSTOM_SECTION_FALLBACK_TITLE = "Untitled section";

export function customSectionLabel(section: CustomSection): string {
  return section.title?.trim() || CUSTOM_SECTION_FALLBACK_TITLE;
}

// A fresh custom section. `order` places it in the document order (callers pass
// one past the current last section so it appends at the end).
export function newCustomSection(order: number): CustomSection {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `cs_${crypto.randomUUID()}`
        : `cs_${order}_${RESUME_SECTIONS.length}`,
    title: "",
    layoutType: "bullets",
    bulletStyle: "bullet",
    order,
    visible: true,
    collapsed: false,
    freeText: "",
    items: [],
  };
}

// Whether a custom section has any content worth rendering. Like default
// sections, an empty custom section is hidden automatically.
export function customSectionHasContent(section: CustomSection): boolean {
  switch (section.layoutType) {
    case "freeText":
      return Boolean(section.freeText?.trim());
    case "bullets":
    case "twoColumnBullets":
      return (section.items ?? []).some((it) => it.value?.trim());
    case "categoryValue":
      return (section.items ?? []).some(
        (it) => it.category?.trim() || it.value?.trim()
      );
  }
}

// THE one unified document order. Merges the fixed default sections with the
// user-defined custom sections into a single list sorted by `order`. Returns
// every section (visible or not) so the builder's reorder UI can show them all;
// use `orderedVisibleDocSections` for rendering.
export function orderedDocSections(
  data: ResumeData,
  saved?: ResumeSectionState[] | null
): DocSectionEntry[] {
  const defaults: DocSectionEntry[] = resolveSectionState(saved).map((s) => ({
    kind: "default",
    sectionId: s.sectionId,
    label: sectionLabel(s),
    order: s.order,
    visible: s.visible,
    pageBreakAfter: s.pageBreakAfter ?? false,
  }));
  const customs: DocSectionEntry[] = (data.customSections ?? []).map((c) => ({
    kind: "custom",
    id: c.id,
    label: customSectionLabel(c),
    order: c.order,
    visible: c.visible,
    pageBreakAfter: c.pageBreakAfter ?? false,
    section: c,
  }));
  return [...defaults, ...customs].sort((a, b) => a.order - b.order);
}

// The unified document order filtered to entries that are visible and non-empty.
// The preview, PDF, DOCX, and PPTX exports all consume this so default and
// custom sections render in the same sequence everywhere.
export function orderedVisibleDocSections(
  data: ResumeData,
  saved?: ResumeSectionState[] | null
): DocSectionEntry[] {
  return orderedDocSections(data, saved).filter((entry) =>
    entry.kind === "default"
      ? entry.visible && sectionHasContent(data, entry.sectionId)
      : entry.visible && customSectionHasContent(entry.section)
  );
}
