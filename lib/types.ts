// Core domain types for ResumeFlow MVP.
// The same ResumeData shape renders across every template.

export type TemplateId =
  | "modern"
  | "classic"
  | "minimal"
  | "custom"
  | "ats-corporate"
  | "cognizant";

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  // When true, the template stays in the data model (existing resumes still
  // render) but is hidden from the template picker.
  hidden?: boolean;
}

// ---- Resume data (template-agnostic) ----

export interface ResumeBasics {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
}

export interface ResumeExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface ResumeProject {
  name: string;
  description: string;
  link: string;
}

// Metadata for a profile photo stored as a separate file in Google Drive
// appDataFolder. The image bytes are NOT stored in the resume JSON.
export interface ProfilePhotoMeta {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

// How the profile photo is masked in templates that render it (currently ATS Corporate Style):
// "square" = rounded rectangle, "circle" = circular (square frame).
export type ProfilePhotoShape = "square" | "circle";

// Marker style for the Areas of Expertise list. Honored by the ATS Corporate Style template
// (and any template that renders Areas of Expertise) plus the DOCX/PPTX
// exporters as closely as each format allows.
export type ResumeBulletStyle = "bullet" | "dash" | "check" | "arrow" | "none";

// ---- Custom resume sections ----

// User-defined resume sections, in addition to the fixed default sections.
// A custom section lives on ResumeData (so it round-trips through resumes.json
// with the rest of the resume content) and carries its own order/visibility so
// it participates in the same document ordering as the default sections.
export type CustomSectionLayoutType =
  | "freeText"
  | "bullets"
  | "twoColumnBullets"
  | "categoryValue";

// One entry inside a custom section.
//   • bullets / twoColumnBullets: the bullet text lives in `value`; `category`
//     is unused.
//   • categoryValue: `category` is the row label and `value` its content
//     (e.g. category "Database", value "DB2, Oracle").
export interface CustomSectionItem {
  category: string;
  value: string;
}

export interface CustomSection {
  id: string;
  title: string;
  layoutType: CustomSectionLayoutType;
  // Marker style for the bullets / twoColumnBullets layouts.
  bulletStyle: ResumeBulletStyle;
  // Document order; shares one ordering space with the default sections.
  order: number;
  // Whether the section appears in the preview and exports.
  visible: boolean;
  // Force a page break after this section in the preview and PDF (ATS Corporate Style template).
  pageBreakAfter?: boolean;
  // Builder-side affordance: whether the section's editor card is collapsed.
  collapsed: boolean;
  // Paragraph content for the freeText layout.
  freeText: string;
  // Items for the bullets / twoColumnBullets / categoryValue layouts.
  items: CustomSectionItem[];
}

export interface ResumeData {
  basics: ResumeBasics;
  // Profile photo as a Base64 data URL. Used in local development mode (no
  // Google Drive). When Drive storage is active this is left empty and
  // profilePhotoMeta points at the uploaded Drive image instead.
  profilePhoto: string;
  // Drive-backed profile photo metadata (driveFileId, fileName, mimeType,
  // createdAt). Null/undefined when there is no Drive photo.
  profilePhotoMeta?: ProfilePhotoMeta | null;
  // Shape the profile photo is rendered with in templates that show it (ATS Corporate Style):
  // "square" is a rounded rectangle (default), "circle" is circular. Older
  // records may not have this; consumers default to "square".
  profilePhotoShape?: ProfilePhotoShape;
  areasOfExpertise: string[];
  // Marker style used when rendering Areas of Expertise. Older records may not
  // have this; consumers default to "bullet".
  areasOfExpertiseBulletStyle: ResumeBulletStyle;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  // Legacy flat skills list. Retained for migration: when `skillCategories` is
  // empty these are shown (as value-only rows). New data uses skillCategories.
  skills: string[];
  // Technical Skills as Category / Value rows (e.g. "Mainframe" → "COBOL, JCL").
  // The canonical source for the Technical Skills section.
  skillCategories: CustomSectionItem[];
  projects: ResumeProject[];
  certifications: string[];
  languages: string[];
  // User-defined sections, ordered among the default sections via each
  // section's `order`. Older records may not have this; consumers default to [].
  customSections: CustomSection[];
}

// ---- Template style settings ----

// Per-resume-version font and color customization. The same shape is reusable
// across every template; ATS Corporate Style is the first template fully wired to honor it.
// All color fields are CSS color strings (hex), fontFamily is a CSS
// font-family stack.
// Page margins for the rendered resume, in millimeters. Applied as the printed
// @page margin (PDF) and as the on-screen sheet padding in the A4 preview.
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Independent spacing knobs for the rendered resume. `section` and `bullet` are
// in rem; `text` is a unitless CSS line-height multiplier.
export interface LineSpacing {
  // Vertical gap before each section heading block (rem).
  section: number;
  // Line height for body/text (unitless multiplier, e.g. 1.6).
  text: number;
  // Gap between consecutive list / bullet items (rem).
  bullet: number;
}

// Per-element font-size multipliers, relative to the base body size. Lets the
// candidate name and section headings be sized independently of body text.
export interface FontScale {
  name: number;
  heading: number;
}

export interface TemplateStyleSettings {
  // Font family applied to the whole resume.
  fontFamily: string;
  // Base font size in px for body text. The name and section headings are sized
  // from this via `fontScale`. Older records may omit this; resolveTemplateStyle
  // fills in the default.
  fontSize: number;
  // Multipliers (× body size) for the name and section headings. Older records
  // may omit this; resolveTemplateStyle fills in the default.
  fontScale: FontScale;
  // Headings, candidate name, important labels, and section divider lines.
  primaryColor: string;
  // Main body text.
  bodyColor: string;
  // Secondary / meta text (contact line, dates, locations).
  mutedColor: string;
  // Section divider line color.
  sectionLineColor: string;
  // Page margins (mm) for the preview sheet and the printed PDF. Older records
  // may omit this; resolveTemplateStyle fills in the default.
  pageMargins: PageMargins;
  // Section / text / bullet spacing. Older records may omit this;
  // resolveTemplateStyle fills in the default.
  lineSpacing: LineSpacing;
}

// ---- Resume builder form layout ----

// Per-card collapse + ordering state for the resume builder form. Persisted per
// resume version so each version remembers how the user arranged and collapsed
// its input cards. `cardId` matches an entry in RESUME_FORM_CARDS (constants).
export interface ResumeFormCardState {
  cardId: string;
  title: string;
  collapsed: boolean;
  order: number;
}

// ---- Resume document sections ----

// The reorderable/toggleable body sections of the rendered resume. This is the
// document structure (what appears in the preview and exports), independent of
// the builder form cards. The header (name/title/contact) is always rendered
// first and is not a reorderable section. Ids match RESUME_SECTIONS in
// constants and overlap with the corresponding RESUME_FORM_CARDS cardIds.
export type ResumeSectionId =
  | "summary"
  | "areas"
  | "experience"
  | "skills"
  | "projects"
  | "education"
  | "certifications"
  | "languages";

// Per-section visibility + ordering for the rendered resume document. Persisted
// per resume version so each version remembers its own document structure.
// `collapsed` is a builder-side affordance; `visible` controls whether the
// section appears in the preview and exports.
//
// `defaultTitle` is the canonical section name (from RESUME_SECTIONS).
// `customTitle` is an optional per-version user override. Everything that
// renders a section heading — builder, preview, PDF/DOCX/PPTX — uses
// `customTitle || defaultTitle` (see `sectionLabel` in constants).
export interface ResumeSectionState {
  sectionId: ResumeSectionId;
  defaultTitle: string;
  customTitle?: string;
  collapsed: boolean;
  order: number;
  visible: boolean;
  // Force a page break after this section in the preview and PDF (ATS Corporate Style template).
  pageBreakAfter?: boolean;
}

// A single entry in the unified resume document order: either one of the fixed
// default sections or a user-defined custom section. `orderedDocSections`
// (constants) merges both kinds into one list sorted by `order`, so the
// builder, preview, and every export render the same sequence.
export type DocSectionEntry =
  | {
      kind: "default";
      sectionId: ResumeSectionId;
      label: string;
      order: number;
      visible: boolean;
      pageBreakAfter: boolean;
    }
  | {
      kind: "custom";
      id: string;
      label: string;
      order: number;
      visible: boolean;
      pageBreakAfter: boolean;
      section: CustomSection;
    };

// ---- AI tailoring metadata ----

// One section's outcome from an AI tailoring run, used to render the change
// summary the user reviews before saving. `rejected` means the model's output
// for that section failed truth-preservation verification and the source
// content was kept instead.
export interface SectionChange {
  // e.g. "summary", "experience", "skills", "areasOfExpertise".
  section: string;
  changeType:
    | "rephrased"
    | "reordered"
    | "emphasized"
    | "unchanged"
    | "rejected";
  // Short human-readable explanation for the review/summary UI.
  note: string;
}

// Recorded on a resume version produced by AI tailoring. The job description is
// SNAPSHOTTED at generation time — the source application's JD may change later,
// but this records what the version was actually tailored against.
export interface TailoredResumeMetadata {
  sourceResumeId: string;
  applicationId?: string;
  company: string;
  jobTitle: string;
  jobId: string;
  jobDescriptionSnapshot: string;
  model: string; // model that produced the tailoring
  generatedAt: string; // ISO timestamp
  sectionChanges: SectionChange[];
}

// ---- Resume version ----

export interface ResumeVersion {
  id: string;
  versionName: string;
  versionNumber: number;
  targetRole: string;
  selectedTemplate: TemplateId;
  // Optional font/color overrides for the selected template. Older records may
  // not have this; renderers fall back to default style settings.
  templateStyle?: TemplateStyleSettings;
  // Collapse + order of the resume builder form cards. Older records may not
  // have this; the builder falls back to the default card layout.
  formCardState?: ResumeFormCardState[];
  // Order + visibility of the rendered resume document sections. Drives the
  // preview and all exports (PDF/DOCX/PPTX). Older records may not have this;
  // renderers fall back to the canonical default section order (all visible).
  sectionState?: ResumeSectionState[];
  // How this version was produced. Older records have no value; consumers
  // default to "manual".
  origin?: "manual" | "tailored";
  // For tailored versions: the version this one was derived from.
  sourceResumeId?: string;
  // Present only on tailored versions (origin === "tailored").
  tailoredMetadata?: TailoredResumeMetadata;
  createdAt: string;
  updatedAt: string;
  resumeData: ResumeData;
}

// ---- Job application ----

export type ApplicationStatus =
  | "Saved"
  | "Applied"
  | "Phone Screen"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Withdrawn";

export interface Application {
  id: string;
  company: string;
  jobTitle: string;
  jobId: string;
  jobLink: string;
  jobDescription: string;
  resumeVersionUsed: string; // ResumeVersion id ("" if none)
  status: ApplicationStatus;
  appliedDate: string;
  nextAction: string;
  nextActionDate: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Notes ----

export type NoteType = "general" | "recruiter" | "interview" | "todo";

export interface Note {
  id: string;
  applicationId: string;
  type: NoteType;
  text: string;
  createdAt: string;
}

// ---- Interview Q&A ----

export type QnaDifficulty = "easy" | "medium" | "hard";

export interface QnaItem {
  id: string;
  applicationId: string;
  question: string;
  answer: string;
  category: string;
  difficulty: QnaDifficulty;
  practiced: boolean;
  createdAt: string;
}

// ---- Status history ----

export interface StatusHistoryEntry {
  id: string;
  applicationId: string;
  oldStatus: ApplicationStatus | "";
  newStatus: ApplicationStatus;
  changedAt: string;
  comment: string;
}

// ---- Document metadata (metadata only, no file storage) ----

export interface DocumentMeta {
  id: string;
  applicationId: string;
  resumeVersionId: string;
  name: string;
  type: string; // e.g. "Resume", "Cover Letter", "Portfolio"
  link: string;
  createdAt: string;
}

// ---- AI / user settings ----

// Per-user AI configuration for the "Improve with AI" feature. Stored as a
// singleton (id === "singleton") in the user's own Google Drive appData so the
// app server never persists it. `apiKeyEnc` is the AES-256-GCM encrypted API
// key (see lib/crypto.ts) — the raw key is never stored or returned to the
// browser after it is saved.
export type AiProvider = "openrouter";

export interface UserSettings {
  id: string; // always "singleton"
  provider: AiProvider;
  model: string; // OpenRouter model slug, e.g. "openai/gpt-4o-mini"
  apiKeyEnc: string; // encrypted; "" when no key is configured
  // Per-user daily usage of the shared (app-provided) AI key. Reset when the
  // UTC day rolls over. Users on their own key (BYOK) are not metered.
  usage?: { day: string; count: number };
  // Id of the resume version designated as the Base Resume (the clean master,
  // like git `main`). A single pointer rather than a per-version flag, so
  // "exactly one base" falls out of the data shape. May be undefined (no base
  // set) or dangling (points at a deleted version) — consumers resolve it via
  // lib/baseResume.resolveBaseResumeId, which treats a dangling pointer as none.
  baseResumeId?: string;
  // Admin-controlled per-template visibility overrides, keyed by TemplateId.
  // A present boolean overrides the template's hardcoded `hidden` default:
  // true = show in the picker, false = hide. Absent ids fall back to the
  // hardcoded default (see lib/constants.resolveVisibleTemplates). Lets an admin
  // turn the otherwise-hidden templates on/off without a code change.
  templateVisibility?: Record<string, boolean>;
  updatedAt: string;
}

// Map collection name -> stored entity type.
export interface Collections {
  resumes: ResumeVersion;
  applications: Application;
  notes: Note;
  qna: QnaItem;
  statusHistory: StatusHistoryEntry;
  documents: DocumentMeta;
  settings: UserSettings;
}

export type CollectionName = keyof Collections;
