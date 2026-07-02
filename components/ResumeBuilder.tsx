"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  CustomSection,
  CustomSectionItem,
  CustomSectionLayoutType,
  DocSectionEntry,
  ResumeBulletStyle,
  ResumeData,
  ResumeEducation,
  ResumeExperience,
  ResumeFormCardState,
  ResumeProject,
  ResumeSectionState,
  ResumeVersion,
  TemplateId,
  TemplateMeta,
  TemplateStyleSettings,
} from "@/lib/types";
import { DEFAULT_PROFILE_PHOTO_POSITION } from "@/lib/types";
import {
  BULLET_STYLE_OPTIONS,
  CUSTOM_LAYOUT_OPTIONS,
  DEFAULT_TEMPLATE_ID,
  VISIBLE_TEMPLATES,
  FONT_OPTIONS,
  customSectionLabel,
  defaultTemplateStyle,
  emptyResumeData,
  newCustomSection,
  normalizeTemplateId,
  orderedDocSections,
  resolveFormCardState,
  resolveSectionState,
  resolveTemplateStyle,
  sectionLabel,
} from "@/lib/constants";
import ResumeTemplateRenderer from "./ResumeTemplateRenderer";
import A4Preview from "./A4Preview";
import TemplateSelector from "./TemplateSelector";
import RichTextEditor from "./RichTextEditor";
import ImproveButton from "./ImproveButton";
import { htmlToLines, linesToHtml } from "@/lib/richText";
import { scoreResume } from "@/lib/atsScore";
import AtsScorePanel, { ScoreRing, scoreBandClass } from "./AtsScorePanel";
import { buttonClass } from "./ui";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

// One-tap layout density presets: each sets the body size, page margins, and
// line spacing together. "Balanced" mirrors defaultTemplateStyle().
// Labels/descriptions are translated at render time via the preset id
// (builder.style.presets.<id>).
type LayoutPreset = {
  id: string;
  fontSize: number;
  margins: number;
  lineSpacing: TemplateStyleSettings["lineSpacing"];
};
const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "compact",
    fontSize: 12,
    margins: 10,
    lineSpacing: { section: 0.6, text: 1.35, bullet: 0.05 },
  },
  {
    id: "balanced",
    fontSize: 13,
    margins: 12,
    lineSpacing: { section: 1, text: 1.6, bullet: 0.15 },
  },
  {
    id: "spacious",
    fontSize: 13.5,
    margins: 16,
    lineSpacing: { section: 1.4, text: 1.8, bullet: 0.3 },
  },
];

function layoutPresetActive(p: LayoutPreset, s: TemplateStyleSettings): boolean {
  return (
    s.fontSize === p.fontSize &&
    marginsUniform(s.pageMargins) &&
    s.pageMargins.top === p.margins &&
    s.lineSpacing.section === p.lineSpacing.section &&
    s.lineSpacing.text === p.lineSpacing.text &&
    s.lineSpacing.bullet === p.lineSpacing.bullet
  );
}

function marginsUniform(m: TemplateStyleSettings["pageMargins"]): boolean {
  return m.top === m.right && m.top === m.bottom && m.top === m.left;
}

// Curated resume color schemes (primary accent + section rule color).
// Display names are translated at render time via the id (builder.style.themes.<id>).
const COLOR_THEMES = [
  { id: "corporateBlue", primary: "#0033A0", line: "#111111" },
  { id: "graphite", primary: "#111827", line: "#111827" },
  { id: "indigo", primary: "#4F46E5", line: "#312E81" },
  { id: "forest", primary: "#065F46", line: "#064E3B" },
  { id: "burgundy", primary: "#7F1D1D", line: "#7F1D1D" },
];

// Form-card ids that configure the document rather than hold resume content.
// The desktop rail groups these under "Setup"; the rest are "Content".
// "ats" is the analysis card — grouped with Setup, surfaced via the score ring.
const CONFIG_CARD_IDS = new Set(["template", "style", "sections", "version", "ats"]);

interface Props {
  mode: "create" | "edit";
  initial?: ResumeVersion;
  // Templates offered in the picker, resolved against the admin visibility
  // overrides on the server. Falls back to the static visible set.
  availableTemplates?: TemplateMeta[];
}

export default function ResumeBuilder({
  mode,
  initial,
  availableTemplates = VISIBLE_TEMPLATES,
}: Props) {
  const router = useRouter();
  const t = useTranslations("builder");

  const [versionName, setVersionName] = useState(initial?.versionName ?? "");
  const [targetRole, setTargetRole] = useState(initial?.targetRole ?? "");
  const [template, setTemplate] = useState<TemplateId>(
    initial
      ? normalizeTemplateId(initial.selectedTemplate)
      : availableTemplates[0]?.id ?? DEFAULT_TEMPLATE_ID
  );
  const [data, setData] = useState<ResumeData>(() => {
    // Shallow-merge with defaults so resumes saved before a field existed
    // (e.g. areasOfExpertise) load with a safe empty array instead of undefined.
    const base = initial?.resumeData
      ? { ...emptyResumeData(), ...initial.resumeData }
      : emptyResumeData();
    // Migrate a legacy flat skills list into Category/Value rows (value-only)
    // so older resumes open in the new Technical Skills editor.
    if (
      (base.skillCategories ?? []).length === 0 &&
      (base.skills ?? []).length > 0
    ) {
      base.skillCategories = base.skills.map((value) => ({
        category: "",
        value,
      }));
    }
    // skillCategories is now the single source for Technical Skills; clear the
    // legacy flat list so removing all rows can't fall back to stale skills.
    base.skills = [];
    return base;
  });
  // Per-version font + color settings. Missing/partial saved styles are merged
  // with defaults so older resumes load with the default look.
  const [templateStyle, setTemplateStyle] = useState<TemplateStyleSettings>(() =>
    resolveTemplateStyle(initial?.templateStyle)
  );
  // Per-version collapse + order of the builder form cards. Merged with the
  // canonical card list so new cards appear and removed cards drop out.
  const [formCards, setFormCards] = useState<ResumeFormCardState[]>(() =>
    resolveFormCardState(initial?.formCardState)
  );
  // Per-version document section order + visibility. Drives the live preview and
  // every export. Merged with the canonical section list so new sections appear
  // and removed sections drop out.
  const [sectionState, setSectionState] = useState<ResumeSectionState[]>(() =>
    resolveSectionState(initial?.sectionState)
  );
  function patchStyle<K extends keyof TemplateStyleSettings>(
    key: K,
    value: TemplateStyleSettings[K]
  ) {
    setTemplateStyle((s) => ({ ...s, [key]: value }));
  }
  function patchMargin(side: keyof TemplateStyleSettings["pageMargins"], mm: number) {
    // Clamp to a sane A4 range so content can never be squeezed off the page.
    const value = Math.max(0, Math.min(40, Number.isFinite(mm) ? mm : 0));
    setTemplateStyle((s) => ({
      ...s,
      pageMargins: { ...s.pageMargins, [side]: value },
    }));
  }
  // The "Page margins" slider sets all four sides at once; per-side tuning
  // lives in the "Per-side margins" disclosure.
  function setAllMargins(mm: number) {
    const value = Math.max(0, Math.min(40, Number.isFinite(mm) ? mm : 0));
    setTemplateStyle((s) => ({
      ...s,
      pageMargins: { top: value, right: value, bottom: value, left: value },
    }));
  }
  function applyLayoutPreset(p: LayoutPreset) {
    setTemplateStyle((s) => ({
      ...s,
      fontSize: p.fontSize,
      pageMargins: {
        top: p.margins,
        right: p.margins,
        bottom: p.margins,
        left: p.margins,
      },
      lineSpacing: { ...p.lineSpacing },
    }));
  }
  function patchScale(
    key: keyof TemplateStyleSettings["fontScale"],
    raw: number
  ) {
    // Multiplier of the base body size; clamp to a sensible range.
    const value = Math.max(0.8, Math.min(4, Number.isFinite(raw) ? raw : 1));
    setTemplateStyle((s) => ({
      ...s,
      fontScale: { ...s.fontScale, [key]: value },
    }));
  }
  function patchSpacing(
    key: keyof TemplateStyleSettings["lineSpacing"],
    raw: number
  ) {
    // Text is a line-height multiplier (0.8–3); section/bullet are rem gaps (0–3).
    const max = key === "text" ? 3 : 3;
    const min = key === "text" ? 0.8 : 0;
    const value = Math.max(min, Math.min(max, Number.isFinite(raw) ? raw : min));
    setTemplateStyle((s) => ({
      ...s,
      lineSpacing: { ...s.lineSpacing, [key]: value },
    }));
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Create-mode "Import from PDF/Word": parse an uploaded resume with AI and
  // pre-fill the builder. Persists nothing — the user reviews then presses
  // "Create resume" through the normal save path.
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNote, setImportNote] = useState("");
  // Live-preview-only: render the ATS-safe layout (single column, no photo).
  const [atsView, setAtsView] = useState(false);
  // Mobile-only: which pane is showing. On large screens both are always
  // visible side-by-side, so this is ignored there.
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  // Mobile section chip grid: collapsed to ~2 rows by default with a "More"
  // expander. chipClip is measured from the wrapped layout so the clip lands
  // exactly on a row boundary (no half-cut chips); null until measured.
  const [sectionsExpanded, setSectionsExpanded] = useState(false);
  const chipRowRef = useRef<HTMLDivElement>(null);
  const [chipClip, setChipClip] = useState<{ maxH: number; hidden: number } | null>(
    null
  );
  // Mobile preview zoom (1 = fit to screen width). Desktop ignores this.
  const [previewZoom, setPreviewZoom] = useState(1);
  // Which form card (section) is in focus — drives the rail, the mobile
  // stepper, and the single visible SectionCard.
  const [currentCard, setCurrentCard] = useState(0);
  // The specific list entry being edited (e.g. one Work Experience role), as
  // "cardId:index". When set, the preview highlight narrows from the whole
  // section to just that entry and that entry is the expanded accordion card.
  // Cleared on ordinary section navigation.
  const [activeItem, setActiveItem] = useState<string | null>(null);
  // Set when activeItem was chosen away from the form (preview click, Add):
  // the matching form entry scrolls into view and flashes once.
  const pendingFormScroll = useRef(false);
  // Job description for the ATS keyword match. Kept client-side per resume
  // (localStorage) until the tailoring flow moves it onto the version record.
  const jdStorageKey = `rf-jd-${initial?.id ?? "new"}`;
  const [jobDescription, setJobDescription] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(jdStorageKey);
      if (saved) setJobDescription(saved);
    } catch {
      /* storage unavailable (private mode) — score still works, JD just won't persist */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function onJobDescriptionChange(value: string) {
    setJobDescription(value);
    try {
      localStorage.setItem(jdStorageKey, value);
    } catch {
      /* see above */
    }
  }
  // Live ATS score: pure local computation, recomputed as the user types.
  const atsResult = useMemo(
    () => scoreResume(data, jobDescription),
    [data, jobDescription]
  );
  // Autosave status (edit mode only).
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  // Skip the autosave that the initialization render would otherwise trigger.
  const skipFirstAutosave = useRef(true);

  // ----- Form card layout (rail order) -----
  // Move a card up (-1) or down (+1) one position in the form and renumber.
  function moveCard(cardId: string, dir: -1 | 1) {
    setFormCards((cards) => {
      const ordered = [...cards].sort((a, b) => a.order - b.order);
      const from = ordered.findIndex((c) => c.cardId === cardId);
      const to = from + dir;
      if (from === -1 || to < 0 || to >= ordered.length) return cards;
      [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
      return ordered.map((c, i) => ({ ...c, order: i }));
    });
  }

  // ----- Document section layout (reorder + visibility) -----
  // Default sections and custom sections share one document order. Moving any
  // entry up/down swaps it in the merged list, then a clean global 0..n-1 order
  // is written back to BOTH stores (sectionState for defaults, customSections
  // for customs) so the interleaving survives save/load and every renderer.
  function moveDocSection(kind: DocSectionEntry["kind"], id: string, dir: -1 | 1) {
    const combined = orderedDocSections(data, sectionState);
    const from = combined.findIndex(
      (e) => e.kind === kind && (e.kind === "default" ? e.sectionId : e.id) === id
    );
    const to = from + dir;
    if (from === -1 || to < 0 || to >= combined.length) return;
    [combined[from], combined[to]] = [combined[to], combined[from]];
    const orderByDefault = new Map<string, number>();
    const orderByCustom = new Map<string, number>();
    combined.forEach((e, i) => {
      if (e.kind === "default") orderByDefault.set(e.sectionId, i);
      else orderByCustom.set(e.id, i);
    });
    setSectionState((sections) =>
      sections.map((s) => ({
        ...s,
        order: orderByDefault.get(s.sectionId) ?? s.order,
      }))
    );
    setData((d) => ({
      ...d,
      customSections: (d.customSections ?? []).map((c) => ({
        ...c,
        order: orderByCustom.get(c.id) ?? c.order,
      })),
    }));
  }
  // Toggle a document section's visibility, dispatching to the right store.
  function toggleDocVisible(kind: DocSectionEntry["kind"], id: string) {
    if (kind === "custom") {
      updateCustomSection(id, undefined, (c) => ({ visible: !c.visible }));
    } else {
      setSectionState((sections) =>
        sections.map((s) =>
          s.sectionId === id ? { ...s, visible: !s.visible } : s
        )
      );
    }
  }
  // Toggle a forced page break after a document section (preview + PDF).
  function togglePageBreak(kind: DocSectionEntry["kind"], id: string) {
    if (kind === "custom") {
      updateCustomSection(id, undefined, (c) => ({
        pageBreakAfter: !c.pageBreakAfter,
      }));
    } else {
      setSectionState((sections) =>
        sections.map((s) =>
          s.sectionId === id
            ? { ...s, pageBreakAfter: !s.pageBreakAfter }
            : s
        )
      );
    }
  }
  // Rename a document section. A blank/whitespace value clears the custom label
  // so the section falls back to its default title. The label flows into the
  // live preview and every export via `sectionState`.
  function renameSection(sectionId: string, value: string) {
    const custom = value.trim();
    setSectionState((sections) =>
      sections.map((s) =>
        s.sectionId === sectionId
          ? { ...s, customTitle: custom || undefined }
          : s
      )
    );
  }
  function resetSectionLabel(sectionId: string) {
    setSectionState((sections) =>
      sections.map((s) =>
        s.sectionId === sectionId ? { ...s, customTitle: undefined } : s
      )
    );
  }
  // Quick lookup of section state by id; section form-card ids (summary, areas,
  // experience, …) map 1:1 to document sections, so a card is a content section
  // exactly when its cardId is found here.
  const sectionById = useMemo(() => {
    const map: Record<string, ResumeSectionState> = {};
    sectionState.forEach((s) => {
      map[s.sectionId] = s;
    });
    return map;
  }, [sectionState]);

  function patchBasics<K extends keyof ResumeData["basics"]>(
    key: K,
    value: ResumeData["basics"][K]
  ) {
    setData((d) => ({ ...d, basics: { ...d.basics, [key]: value } }));
  }

  // The photo to show in the form preview: a Drive-backed image is served by a
  // secure server route (the OAuth token never reaches the browser); otherwise
  // fall back to the local Base64 data URL.
  const photoSrc = data.profilePhotoMeta?.driveFileId
    ? `/api/drive/photos/${data.profilePhotoMeta.driveFileId}`
    : data.profilePhoto || "";
  // Selected photo shape (ATS Corporate Style template); older records default to "square".
  const photoShape = data.profilePhotoShape ?? "square";
  // Focal point for the photo's cover-crop; the user drags the preview to set it.
  const photoPos = data.profilePhotoPosition ?? DEFAULT_PROFILE_PHOTO_POSITION;
  const photoDragging = useRef(false);
  // Drag the preview to reposition the crop. Moving the image one way shifts the
  // visible focal point the opposite way (like dragging a photo under a mask).
  function onPhotoPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (!photoSrc) return;
    photoDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPhotoPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    if (!photoDragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.movementX / rect.width) * 100;
    const dy = (e.movementY / rect.height) * 100;
    setData((prev) => {
      const cur = prev.profilePhotoPosition ?? DEFAULT_PROFILE_PHOTO_POSITION;
      return {
        ...prev,
        profilePhotoPosition: {
          x: Math.round(Math.min(100, Math.max(0, cur.x - dx))),
          y: Math.round(Math.min(100, Math.max(0, cur.y - dy))),
        },
      };
    });
  }
  function onPhotoPointerUp(e: React.PointerEvent<HTMLImageElement>) {
    photoDragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already be released; ignore.
    }
  }
  const photoRepositioned =
    photoPos.x !== DEFAULT_PROFILE_PHOTO_POSITION.x ||
    photoPos.y !== DEFAULT_PROFILE_PHOTO_POSITION.y;

  // ----- Profile photo -----
  // Upload through the server, which stores the image in Google Drive
  // appDataFolder (Drive mode) or returns a Base64 data URL (local dev mode).
  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later by clearing the input value.
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/drive/photos/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(t("errors.photoUpload"));
      const result = await res.json();
      if (result.mode === "drive") {
        setData((d) => ({
          ...d,
          profilePhoto: "",
          profilePhotoMeta: result.profilePhotoMeta,
        }));
      } else {
        setData((d) => ({
          ...d,
          profilePhoto: result.profilePhoto ?? "",
          profilePhotoMeta: null,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.photoUpload"));
    } finally {
      setUploadingPhoto(false);
    }
  }
  function removePhoto() {
    // Best-effort delete of the Drive image; the metadata is cleared regardless.
    const fileId = data.profilePhotoMeta?.driveFileId;
    if (fileId) {
      fetch(`/api/drive/photos/${fileId}`, { method: "DELETE" }).catch(() => {});
    }
    setData((d) => ({ ...d, profilePhoto: "", profilePhotoMeta: null }));
  }

  // ----- Areas of Expertise (item-by-item editor) -----
  function addArea(value: string) {
    const text = value.trim();
    if (!text) return;
    setData((d) => ({ ...d, areasOfExpertise: [...d.areasOfExpertise, text] }));
  }
  function updateArea(i: number, value: string) {
    setData((d) => ({
      ...d,
      areasOfExpertise: d.areasOfExpertise.map((a, idx) =>
        idx === i ? value : a
      ),
    }));
  }
  function removeArea(i: number) {
    setData((d) => ({
      ...d,
      areasOfExpertise: d.areasOfExpertise.filter((_, idx) => idx !== i),
    }));
  }
  function moveArea(i: number, dir: -1 | 1) {
    setData((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.areasOfExpertise.length) return d;
      const next = [...d.areasOfExpertise];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, areasOfExpertise: next };
    });
  }

  // ----- Technical Skills (Category / Value rows) -----
  function addSkillRow() {
    setData((d) => ({
      ...d,
      skillCategories: [...(d.skillCategories ?? []), { category: "", value: "" }],
    }));
  }
  function updateSkillRow(i: number, patch: Partial<CustomSectionItem>) {
    setData((d) => ({
      ...d,
      skillCategories: (d.skillCategories ?? []).map((it, idx) =>
        idx === i ? { ...it, ...patch } : it
      ),
    }));
  }
  function removeSkillRow(i: number) {
    setData((d) => ({
      ...d,
      skillCategories: (d.skillCategories ?? []).filter((_, idx) => idx !== i),
    }));
  }
  function moveSkillRow(i: number, dir: -1 | 1) {
    setData((d) => {
      const items = [...(d.skillCategories ?? [])];
      const j = i + dir;
      if (j < 0 || j >= items.length) return d;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...d, skillCategories: items };
    });
  }

  // ----- Experience -----
  function addExperience() {
    setData((d) => ({
      ...d,
      experience: [
        ...d.experience,
        {
          company: "",
          role: "",
          location: "",
          startDate: "",
          endDate: "",
          highlights: [],
        },
      ],
    }));
  }
  function updateExperience(i: number, patch: Partial<ResumeExperience>) {
    setData((d) => ({
      ...d,
      experience: d.experience.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e
      ),
    }));
  }
  function removeExperience(i: number) {
    setData((d) => ({
      ...d,
      experience: d.experience.filter((_, idx) => idx !== i),
    }));
  }

  // ----- Education -----
  function addEducation() {
    setData((d) => ({
      ...d,
      education: [
        ...d.education,
        { school: "", degree: "", field: "", startDate: "", endDate: "" },
      ],
    }));
  }
  function updateEducation(i: number, patch: Partial<ResumeEducation>) {
    setData((d) => ({
      ...d,
      education: d.education.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e
      ),
    }));
  }
  function removeEducation(i: number) {
    setData((d) => ({
      ...d,
      education: d.education.filter((_, idx) => idx !== i),
    }));
  }

  // ----- Projects -----
  function addProject() {
    setData((d) => ({
      ...d,
      projects: [...d.projects, { name: "", description: "", link: "" }],
    }));
  }
  function updateProject(i: number, patch: Partial<ResumeProject>) {
    setData((d) => ({
      ...d,
      projects: d.projects.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));
  }
  function removeProject(i: number) {
    setData((d) => ({
      ...d,
      projects: d.projects.filter((_, idx) => idx !== i),
    }));
  }

  // ----- Custom sections -----
  // Add a custom section at the end of the document order (one past the current
  // last default or custom section).
  function addCustomSection() {
    const maxOrder = Math.max(
      -1,
      ...sectionState.map((s) => s.order),
      ...(data.customSections ?? []).map((c) => c.order)
    );
    const created = newCustomSection(maxOrder + 1);
    setData((d) => ({
      ...d,
      customSections: [...(d.customSections ?? []), created],
    }));
  }
  // Update a custom section by a static patch and/or a function of its current
  // value (used for toggles that depend on the previous state).
  function updateCustomSection(
    id: string,
    patch?: Partial<CustomSection>,
    fn?: (c: CustomSection) => Partial<CustomSection>
  ) {
    setData((d) => ({
      ...d,
      customSections: (d.customSections ?? []).map((c) =>
        c.id === id ? { ...c, ...(patch ?? {}), ...(fn ? fn(c) : {}) } : c
      ),
    }));
  }
  function deleteCustomSection(id: string) {
    setData((d) => ({
      ...d,
      customSections: (d.customSections ?? []).filter((c) => c.id !== id),
    }));
  }
  // Apply a transform to one custom section's items array.
  function updateCustomItems(
    id: string,
    fn: (items: CustomSectionItem[]) => CustomSectionItem[]
  ) {
    setData((d) => ({
      ...d,
      customSections: (d.customSections ?? []).map((c) =>
        c.id === id ? { ...c, items: fn(c.items ?? []) } : c
      ),
    }));
  }
  function addCustomItem(id: string, item: CustomSectionItem) {
    updateCustomItems(id, (items) => [...items, item]);
  }
  function updateCustomItem(
    id: string,
    idx: number,
    patch: Partial<CustomSectionItem>
  ) {
    updateCustomItems(id, (items) =>
      items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }
  function removeCustomItem(id: string, idx: number) {
    updateCustomItems(id, (items) => items.filter((_, i) => i !== idx));
  }
  function moveCustomItem(id: string, idx: number, dir: -1 | 1) {
    updateCustomItems(id, (items) => {
      const j = idx + dir;
      if (j < 0 || j >= items.length) return items;
      const next = [...items];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  const certsText = useMemo(
    () => data.certifications.join("\n"),
    [data.certifications]
  );
  const languagesText = useMemo(
    () => (data.languages ?? []).join("\n"),
    [data.languages]
  );

  function linesToArray(value: string): string[] {
    return value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Upload one or more resume files, parse them with AI, and replace the builder
  // contents with the extracted data. When several files are given, the server
  // merges them into a single resume. Also seeds a sensible version name /
  // target role from the parsed identity when those are still blank.
  async function importResume(files: File[]) {
    if (files.length === 0) return;
    setImporting(true);
    setImportError("");
    setImportNote("");
    try {
      const form = new FormData();
      for (const file of files) form.append("file", file);
      const res = await fetch("/api/resumes/import", {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || t("errors.import"));
      }
      const imported = json.resumeData as ResumeData;
      // skillCategories is the single source for Technical Skills; drop any
      // legacy flat skills so the new editor shows the extracted rows.
      imported.skills = [];
      setData(imported);
      if (!versionName.trim() && imported.basics?.name) {
        setVersionName(`${imported.basics.name} — imported`);
      }
      if (!targetRole.trim() && imported.basics?.title) {
        setTargetRole(imported.basics.title);
      }
      setImportNote(t("import.imported"));
      // Land the user on Basics so they can review the extracted data.
      const idx = [...formCards]
        .sort((a, b) => a.order - b.order)
        .findIndex((c) => c.cardId === "basics");
      if (idx >= 0) goToCard(idx);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : t("errors.import"));
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        versionName: versionName || "Untitled version",
        targetRole,
        selectedTemplate: template,
        templateStyle,
        formCardState: formCards,
        sectionState,
        resumeData: data,
      };
      const url =
        mode === "create" ? "/api/resumes" : `/api/resumes/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(t("errors.save"));
      const saved = await res.json();
      router.push(`/resumes/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.save"));
      setSaving(false);
    }
  }

  // Debounced autosave — edit mode only. Saves ~1.2s after edits stop so the
  // user never has to hunt for a Save button (the explicit Save still exists
  // and additionally navigates to the preview). New resumes have no record yet,
  // so create mode is excluded until the first explicit "Create resume".
  useEffect(() => {
    if (mode !== "edit" || !initial) return;
    if (skipFirstAutosave.current) {
      skipFirstAutosave.current = false;
      return;
    }
    const t = setTimeout(() => {
      setSaveStatus("saving");
      fetch(`/api/resumes/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionName: versionName || "Untitled version",
          targetRole,
          selectedTemplate: template,
          templateStyle,
          formCardState: formCards,
          sectionState,
          resumeData: data,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error();
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("error"));
    }, 1200);
    return () => clearTimeout(t);
  }, [
    mode,
    initial,
    versionName,
    targetRole,
    template,
    templateStyle,
    formCards,
    sectionState,
    data,
  ]);

  // Content for each form card, keyed by cardId. Cards are rendered in the
  // user-chosen order; the CollapsibleCard wrapper supplies the header, the
  // collapse toggle, and the drag handle.
  const cardContent: Record<
    string,
    { count?: number; headerRight?: React.ReactNode; body: React.ReactNode }
  > = {
    template: {
      body: (
        <TemplateSelector
          value={template}
          onChange={setTemplate}
          templates={availableTemplates}
        />
      ),
    },
    style: {
      headerRight: (
        <button
          type="button"
          onClick={() => setTemplateStyle(defaultTemplateStyle())}
          className="text-xs text-muted-foreground/70 hover:text-brand-600 dark:hover:text-brand-300"
        >
          {t("actions.resetToDefault")}
        </button>
      ),
      body: (
        <>
          {/* Layout density presets — one tap sets size, margins, and spacing. */}
          <div>
            <label className={labelClass}>{t("style.layoutDensity")}</label>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUT_PRESETS.map((p) => {
                const active = layoutPresetActive(p, templateStyle);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyLayoutPreset(p)}
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15 ring-1 ring-brand-500"
                        : "border-input bg-card hover:border-brand-300 dark:hover:border-brand-400/60"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-foreground">
                      {t(`style.presets.${p.id}.label`)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {t(`style.presets.${p.id}.desc`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typography */}
          <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("style.font")}</label>
              <select
                className={inputClass}
                value={templateStyle.fontFamily}
                onChange={(e) => patchStyle("fontFamily", e.target.value)}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <SliderField
              label={t("style.bodyTextSize")}
              value={templateStyle.fontSize}
              min={8}
              max={24}
              step={0.5}
              display={`${templateStyle.fontSize}px`}
              onChange={(v) => patchStyle("fontSize", v)}
            />
            <SliderField
              label={t("style.nameSize")}
              value={templateStyle.fontScale.name}
              min={1}
              max={3}
              step={0.05}
              display={`${templateStyle.fontScale.name.toFixed(2)}×`}
              onChange={(v) => patchScale("name", v)}
            />
            <SliderField
              label={t("style.headingSize")}
              value={templateStyle.fontScale.heading}
              min={0.8}
              max={2}
              step={0.02}
              display={`${templateStyle.fontScale.heading.toFixed(2)}×`}
              onChange={(v) => patchScale("heading", v)}
            />
          </div>

          {/* Colors: curated theme swatches up front, full pickers tucked away. */}
          <div className="mt-4">
            <label className={labelClass}>{t("style.colorTheme")}</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_THEMES.map((theme) => {
                const active =
                  templateStyle.primaryColor.toLowerCase() ===
                  theme.primary.toLowerCase();
                return (
                  <button
                    key={theme.id}
                    type="button"
                    title={t(`style.themes.${theme.id}`)}
                    aria-pressed={active}
                    onClick={() =>
                      setTemplateStyle((s) => ({
                        ...s,
                        primaryColor: theme.primary,
                        sectionLineColor: theme.line,
                      }))
                    }
                    className={`h-8 w-8 rounded-full border-2 transition ${
                      active
                        ? "border-foreground ring-2 ring-ring/50"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: theme.primary }}
                  >
                    <span className="sr-only">{t(`style.themes.${theme.id}`)}</span>
                  </button>
                );
              })}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                {t("style.customColors")}
              </summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <ColorField
                  label={t("style.primaryColor")}
                  value={templateStyle.primaryColor}
                  onChange={(v) => patchStyle("primaryColor", v)}
                />
                <ColorField
                  label={t("style.bodyTextColor")}
                  value={templateStyle.bodyColor}
                  onChange={(v) => patchStyle("bodyColor", v)}
                />
                <ColorField
                  label={t("style.mutedTextColor")}
                  value={templateStyle.mutedColor}
                  onChange={(v) => patchStyle("mutedColor", v)}
                />
                <ColorField
                  label={t("style.sectionLineColor")}
                  value={templateStyle.sectionLineColor}
                  onChange={(v) => patchStyle("sectionLineColor", v)}
                />
              </div>
            </details>
          </div>

          {/* Spacing */}
          <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <SliderField
              label={t("style.pageMargins")}
              value={templateStyle.pageMargins.top}
              min={0}
              max={40}
              step={1}
              display={
                marginsUniform(templateStyle.pageMargins)
                  ? `${templateStyle.pageMargins.top}mm`
                  : t("style.customMargins")
              }
              onChange={setAllMargins}
            />
            <SliderField
              label={t("style.lineHeight")}
              value={templateStyle.lineSpacing.text}
              min={0.8}
              max={3}
              step={0.05}
              display={templateStyle.lineSpacing.text.toFixed(2)}
              onChange={(v) => patchSpacing("text", v)}
            />
            <SliderField
              label={t("style.sectionGap")}
              value={templateStyle.lineSpacing.section}
              min={0}
              max={3}
              step={0.1}
              display={`${templateStyle.lineSpacing.section.toFixed(1)}rem`}
              onChange={(v) => patchSpacing("section", v)}
            />
            <SliderField
              label={t("style.bulletGap")}
              value={templateStyle.lineSpacing.bullet}
              min={0}
              max={1.5}
              step={0.05}
              display={`${templateStyle.lineSpacing.bullet.toFixed(2)}rem`}
              onChange={(v) => patchSpacing("bullet", v)}
            />
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              {t("style.perSideMargins")}
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <div key={side}>
                  <span className="mb-1 block text-xs text-muted-foreground">
                    {t(`style.sides.${side}`)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={1}
                    className={inputClass}
                    value={templateStyle.pageMargins[side]}
                    onChange={(e) => patchMargin(side, e.target.valueAsNumber)}
                  />
                </div>
              ))}
            </div>
          </details>
          <p className="mt-3 text-xs text-muted-foreground/70">
            {t("style.hint")}
          </p>
        </>
      ),
    },
    sections: {
      body: (
        <SectionLayoutEditor
          entries={orderedDocSections(data, sectionState)}
          sectionById={sectionById}
          onMove={moveDocSection}
          onToggleVisible={toggleDocVisible}
          onTogglePageBreak={togglePageBreak}
          onRename={renameSection}
          onResetLabel={resetSectionLabel}
        />
      ),
    },
    version: {
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t("version.name")}</label>
            <input
              className={inputClass}
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder={t("version.namePlaceholder")}
            />
          </div>
          <div>
            <label className={labelClass}>{t("version.targetRole")}</label>
            <input
              className={inputClass}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder={t("version.targetRolePlaceholder")}
            />
          </div>
        </div>
      ),
    },
    ats: {
      headerRight: (
        <span
          className={`text-sm font-bold tabular-nums ${scoreBandClass(
            atsResult.overall
          )}`}
        >
          {atsResult.overall}/100
        </span>
      ),
      body: (
        <AtsScorePanel
          result={atsResult}
          jobDescription={jobDescription}
          onJobDescriptionChange={onJobDescriptionChange}
        />
      ),
    },
    basics: {
      body: (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("basics.fullName")} value={data.basics.name} onChange={(v) => patchBasics("name", v)} />
            <Field label={t("basics.headline")} value={data.basics.title} onChange={(v) => patchBasics("title", v)} />
            <Field label={t("basics.email")} value={data.basics.email} onChange={(v) => patchBasics("email", v)} />
            <Field label={t("basics.phone")} value={data.basics.phone} onChange={(v) => patchBasics("phone", v)} />
            <Field label={t("basics.location")} value={data.basics.location} onChange={(v) => patchBasics("location", v)} />
            <Field label={t("basics.website")} value={data.basics.website} onChange={(v) => patchBasics("website", v)} />
          </div>

          {/* Profile photo */}
          <div className="mt-3">
            <label className={labelClass}>{t("basics.profilePhoto")}</label>
            <div className="flex items-center gap-3">
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoSrc}
                  alt={t("basics.photoAlt")}
                  draggable={false}
                  onPointerDown={onPhotoPointerDown}
                  onPointerMove={onPhotoPointerMove}
                  onPointerUp={onPhotoPointerUp}
                  onPointerCancel={onPhotoPointerUp}
                  title={t("basics.dragToReposition")}
                  className={`h-20 w-20 cursor-move touch-none select-none border border-border object-cover ${
                    photoShape === "circle" ? "rounded-full" : "rounded-md"
                  }`}
                  style={{ objectPosition: `${photoPos.x}% ${photoPos.y}%` }}
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-input text-[10px] text-muted-foreground/70">
                  {t("basics.noPhoto")}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                  {uploadingPhoto
                    ? t("basics.uploading")
                    : photoSrc
                      ? t("basics.changePhoto")
                      : t("basics.uploadPhoto")}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={onPhotoSelected}
                  />
                </label>
                {photoSrc && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-xs text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400"
                  >
                    {t("basics.removePhoto")}
                  </button>
                )}
              </div>
            </div>
            {/* Shape choice (ATS Corporate Style template). Shown once a photo is present. */}
            {photoSrc && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("basics.shape")}</span>
                <div className="inline-flex overflow-hidden rounded-md border border-input">
                  {(["square", "circle"] as const).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() =>
                        setData((d) => ({ ...d, profilePhotoShape: shape }))
                      }
                      className={`px-2.5 py-1 text-xs font-medium ${
                        photoShape === shape
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t(`basics.shapes.${shape}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Reposition hint + reset. The user drags the preview above to set
                the crop's focal point; reset returns it to the default. */}
            {photoSrc && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("basics.dragToReposition")}
                </span>
                {photoRepositioned && (
                  <button
                    type="button"
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        profilePhotoPosition: { ...DEFAULT_PROFILE_PHOTO_POSITION },
                      }))
                    }
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
                  >
                    {t("actions.resetToDefault")}
                  </button>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground/70">
              {t("basics.photoHint")}
            </p>
          </div>
        </>
      ),
    },
    summary: {
      body: (
        <div>
          <label className={labelClass}>{t("summary.label")}</label>
          <RichTextEditor
            value={data.basics.summary}
            onChange={(html) => patchBasics("summary", html)}
            placeholder={t("summary.placeholder")}
          />
          <ImproveButton
            sectionType="summary"
            text={htmlToLines(data.basics.summary).join(" ")}
            onAccept={(v) => patchBasics("summary", v)}
          />
        </div>
      ),
    },
    areas: {
      count: data.areasOfExpertise.length,
      body: (
        <AreasOfExpertiseEditor
          items={data.areasOfExpertise}
          bulletStyle={data.areasOfExpertiseBulletStyle ?? "bullet"}
          onAdd={addArea}
          onUpdate={updateArea}
          onRemove={removeArea}
          onMove={moveArea}
          onBulletStyleChange={(v) =>
            setData((d) => ({ ...d, areasOfExpertiseBulletStyle: v }))
          }
        />
      ),
    },
    experience: {
      count: data.experience.length,
      headerRight: (
        <AddButton
          onClick={() => {
            addExperience();
            setActiveItem(`experience:${data.experience.length}`);
            pendingFormScroll.current = true;
          }}
        />
      ),
      body: (
        <div className="space-y-3">
          {data.experience.map((exp, i) => {
            const itemKey = `experience:${i}`;
            const expanded =
              activeItem === itemKey ||
              (activeItem == null && data.experience.length === 1);
            return (
            <ItemCard
              key={i}
              dataKey={itemKey}
              summary={
                [exp.role, exp.company].filter(Boolean).join(" · ") ||
                t("experience.newRole")
              }
              detail={[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
              expanded={expanded}
              onToggle={() => setActiveItem(expanded ? null : itemKey)}
              onActive={() => setActiveItem(itemKey)}
              onRemove={() => {
                removeExperience(i);
                setActiveItem(null);
              }}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label={t("experience.role")} value={exp.role} onChange={(v) => updateExperience(i, { role: v })} />
                <Field label={t("experience.company")} value={exp.company} onChange={(v) => updateExperience(i, { company: v })} />
                <Field label={t("experience.location")} value={exp.location} onChange={(v) => updateExperience(i, { location: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("common.start")} value={exp.startDate} onChange={(v) => updateExperience(i, { startDate: v })} />
                  <Field label={t("common.end")} value={exp.endDate} onChange={(v) => updateExperience(i, { endDate: v })} />
                </div>
              </div>
              <div className="mt-2">
                <label className={labelClass}>{t("experience.highlights")}</label>
                <RichTextEditor
                  value={linesToHtml(exp.highlights)}
                  onChange={(html) =>
                    updateExperience(i, { highlights: htmlToLines(html) })
                  }
                  showLists={false}
                  hint={t("experience.highlightsHint")}
                  placeholder={t("experience.highlightsPlaceholder")}
                />
                <ImproveButton
                  sectionType="highlights"
                  text={exp.highlights.join("\n")}
                  onAccept={(v) =>
                    updateExperience(i, {
                      highlights: v
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </ItemCard>
            );
          })}
        </div>
      ),
    },
    education: {
      count: data.education.length,
      headerRight: (
        <AddButton
          onClick={() => {
            addEducation();
            setActiveItem(`education:${data.education.length}`);
            pendingFormScroll.current = true;
          }}
        />
      ),
      body: (
        <div className="space-y-3">
          {data.education.map((ed, i) => {
            const itemKey = `education:${i}`;
            const expanded =
              activeItem === itemKey ||
              (activeItem == null && data.education.length === 1);
            return (
            <ItemCard
              key={i}
              dataKey={itemKey}
              summary={
                [[ed.degree, ed.field].filter(Boolean).join(", "), ed.school]
                  .filter(Boolean)
                  .join(" · ") || t("education.newEducation")
              }
              detail={[ed.startDate, ed.endDate].filter(Boolean).join(" – ")}
              expanded={expanded}
              onToggle={() => setActiveItem(expanded ? null : itemKey)}
              onActive={() => setActiveItem(itemKey)}
              onRemove={() => {
                removeEducation(i);
                setActiveItem(null);
              }}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label={t("education.school")} value={ed.school} onChange={(v) => updateEducation(i, { school: v })} />
                <Field label={t("education.degree")} value={ed.degree} onChange={(v) => updateEducation(i, { degree: v })} />
                <Field label={t("education.field")} value={ed.field} onChange={(v) => updateEducation(i, { field: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("common.start")} value={ed.startDate} onChange={(v) => updateEducation(i, { startDate: v })} />
                  <Field label={t("common.end")} value={ed.endDate} onChange={(v) => updateEducation(i, { endDate: v })} />
                </div>
              </div>
            </ItemCard>
            );
          })}
        </div>
      ),
    },
    projects: {
      count: data.projects.length,
      headerRight: (
        <AddButton
          onClick={() => {
            addProject();
            setActiveItem(`projects:${data.projects.length}`);
            pendingFormScroll.current = true;
          }}
        />
      ),
      body: (
        <div className="space-y-3">
          {data.projects.map((p, i) => {
            const itemKey = `projects:${i}`;
            const expanded =
              activeItem === itemKey ||
              (activeItem == null && data.projects.length === 1);
            return (
            <ItemCard
              key={i}
              dataKey={itemKey}
              summary={p.name || t("projects.newProject")}
              expanded={expanded}
              onToggle={() => setActiveItem(expanded ? null : itemKey)}
              onActive={() => setActiveItem(itemKey)}
              onRemove={() => {
                removeProject(i);
                setActiveItem(null);
              }}
            >
              <div className="grid gap-2">
                <Field label={t("projects.name")} value={p.name} onChange={(v) => updateProject(i, { name: v })} />
                <Field label={t("projects.link")} value={p.link} onChange={(v) => updateProject(i, { link: v })} />
                <div>
                  <label className={labelClass}>{t("projects.description")}</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={p.description}
                    onChange={(e) => updateProject(i, { description: e.target.value })}
                  />
                </div>
              </div>
            </ItemCard>
            );
          })}
        </div>
      ),
    },
    skills: {
      count: (data.skillCategories ?? []).length,
      body: (
        <SkillCategoryEditor
          items={data.skillCategories ?? []}
          onAdd={addSkillRow}
          onUpdate={updateSkillRow}
          onRemove={removeSkillRow}
          onMove={moveSkillRow}
        />
      ),
    },
    certifications: {
      count: data.certifications.length,
      body: (
        <div>
          <label className={labelClass}>{t("certifications.label")}</label>
          <textarea
            className={inputClass}
            rows={5}
            value={certsText}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                certifications: linesToArray(e.target.value),
              }))
            }
          />
        </div>
      ),
    },
    languages: {
      count: (data.languages ?? []).length,
      body: (
        <div>
          <label className={labelClass}>{t("languages.label")}</label>
          <textarea
            className={inputClass}
            rows={5}
            value={languagesText}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                languages: linesToArray(e.target.value),
              }))
            }
          />
        </div>
      ),
    },
    customSections: {
      count: (data.customSections ?? []).length,
      headerRight: <AddButton onClick={addCustomSection} />,
      body: (
        <CustomSectionsEditor
          sections={[...(data.customSections ?? [])].sort(
            (a, b) => a.order - b.order
          )}
          onAdd={addCustomSection}
          onUpdate={updateCustomSection}
          onDelete={deleteCustomSection}
          onAddItem={addCustomItem}
          onUpdateItem={updateCustomItem}
          onRemoveItem={removeCustomItem}
          onMoveItem={moveCustomItem}
        />
      ),
    },
  };

  const orderedCards = [...formCards].sort((a, b) => a.order - b.order);
  // Clamp the mobile stepper index in case the card set shrank (custom section
  // removed). Used only for the one-section-at-a-time mobile view.
  const safeCurrent = Math.min(
    currentCard,
    Math.max(0, orderedCards.length - 1)
  );
  const cardTitle = (card: ResumeFormCardState) => {
    const sec = sectionById[card.cardId];
    return sec ? sectionLabel(sec) : card.title;
  };

  const prevCardMeta = safeCurrent > 0 ? orderedCards[safeCurrent - 1] : null;
  const nextCardMeta =
    safeCurrent < orderedCards.length - 1 ? orderedCards[safeCurrent + 1] : null;
  const railEntries = orderedCards.map((card, i) => ({ card, i }));
  const atsCardIndex = orderedCards.findIndex((c) => c.cardId === "ats");
  const setupEntries = railEntries.filter(({ card }) =>
    CONFIG_CARD_IDS.has(card.cardId)
  );
  const contentEntries = railEntries.filter(
    ({ card }) => !CONFIG_CARD_IDS.has(card.cardId)
  );

  // Rail completion status per content card; null for Setup cards (which have
  // no notion of "done").
  function cardStatus(cardId: string): { done: boolean; count?: number } | null {
    switch (cardId) {
      case "basics":
        return {
          done: Boolean(data.basics.name.trim() && data.basics.email.trim()),
        };
      case "summary":
        return {
          done: htmlToLines(data.basics.summary).join("").trim().length > 0,
        };
      case "areas":
        return {
          done: data.areasOfExpertise.length > 0,
          count: data.areasOfExpertise.length,
        };
      case "experience":
        return { done: data.experience.length > 0, count: data.experience.length };
      case "education":
        return { done: data.education.length > 0, count: data.education.length };
      case "projects":
        return { done: data.projects.length > 0, count: data.projects.length };
      case "skills": {
        const n = (data.skillCategories ?? []).length;
        return { done: n > 0, count: n };
      }
      case "certifications":
        return {
          done: data.certifications.length > 0,
          count: data.certifications.length,
        };
      case "languages": {
        const n = (data.languages ?? []).length;
        return { done: n > 0, count: n };
      }
      case "customSections": {
        const n = (data.customSections ?? []).length;
        return { done: n > 0, count: n };
      }
      default:
        return null;
    }
  }

  // Ordinary section navigation (rail, chips, Next/Previous): switching
  // sections drops any narrowed item highlight.
  function goToCard(i: number) {
    setCurrentCard(i);
    setActiveItem(null);
  }

  // The reverse of click-to-edit: highlight the active section — or, when a
  // specific list entry is being edited, just that entry — on the preview
  // sheet and keep it scrolled into view. Scoped to the screen page slices,
  // never the hidden print copy.
  const previewRef = useRef<HTMLDivElement>(null);
  const activeCardId = orderedCards[safeCurrent]?.cardId;
  const [activeItemCard, activeItemIndex] = activeItem?.split(":") ?? [];
  const narrowedIndex =
    activeItemCard === activeCardId ? activeItemIndex : undefined;
  useEffect(() => {
    // No dependency array: the slices' DOM is recreated whenever content or
    // page count changes, so re-apply the marker classes after every render.
    const root = previewRef.current;
    if (!root) return;
    root
      .querySelectorAll<HTMLElement>(".a4-screen-pages [data-rf-section]")
      .forEach((el) => {
        el.classList.toggle(
          "rf-active-section",
          el.dataset.rfSection === activeCardId && narrowedIndex == null
        );
      });
    root
      .querySelectorAll<HTMLElement>(".a4-screen-pages [data-rf-item]")
      .forEach((el) => {
        el.classList.toggle(
          "rf-active-section",
          narrowedIndex != null &&
            el.dataset.rfItem === narrowedIndex &&
            el.closest<HTMLElement>("[data-rf-section]")?.dataset.rfSection ===
              activeCardId
        );
      });
  });
  useEffect(() => {
    const root = previewRef.current;
    if (!root || !activeCardId) return;
    const target =
      (narrowedIndex != null
        ? root.querySelector<HTMLElement>(
            `.a4-screen-pages [data-rf-section="${activeCardId}"] [data-rf-item="${narrowedIndex}"]`
          )
        : null) ??
      root.querySelector<HTMLElement>(
        `.a4-screen-pages [data-rf-section="${activeCardId}"]`
      );
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // narrowedIndex is derived from activeItem; activeCardId from safeCurrent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCardId, activeItem, mobileView]);

  // When an item was picked by clicking the preview, scroll its form entry
  // into view (after the section card has rendered) and flash it briefly.
  useEffect(() => {
    if (!pendingFormScroll.current) return;
    pendingFormScroll.current = false;
    if (!activeItem) return;
    const el = document.querySelector<HTMLElement>(
      `[data-rf-form-item="${activeItem}"]`
    );
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("rf-flash");
    const t = setTimeout(() => el.classList.remove("rf-flash"), 1200);
    return () => clearTimeout(t);
  }, [activeItem]);

  // Measure the wrapped mobile section chips so the collapsed grid clips exactly
  // at the end of the second row (never mid-chip) and we know how many chips are
  // hidden behind "More". Re-measures on resize (ResizeObserver) and whenever the
  // chip set / labels / completion dots change (via chipSignature dep below).
  const chipSignature = orderedCards
    .map((c) => `${cardTitle(c)}|${cardStatus(c.cardId)?.done ? 1 : 0}`)
    .join(",");
  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    const measure = () => {
      const chips = Array.from(
        el.querySelectorAll<HTMLElement>("[data-section-chip]")
      );
      let next: { maxH: number; hidden: number } | null = null;
      if (chips.length > 0) {
        const rowTops: number[] = [];
        for (const c of chips) {
          const top = c.offsetTop;
          if (rowTops.length === 0 || top - rowTops[rowTops.length - 1] > 2) {
            rowTops.push(top);
          }
        }
        if (rowTops.length > 2) {
          const thirdRowTop = rowTops[2];
          const visible = chips.filter((c) => c.offsetTop < thirdRowTop - 2);
          const last = visible[visible.length - 1];
          next = {
            maxH: last.offsetTop + last.offsetHeight,
            hidden: chips.length - visible.length,
          };
        }
      }
      setChipClip((prev) => {
        if (!prev && !next) return prev;
        if (prev && next && prev.maxH === next.maxH && prev.hidden === next.hidden) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chipSignature, mobileView]);

  // Click-to-edit: clicking a section inside the live preview focuses its form
  // card (and flips to the edit pane on mobile); clicking a tagged list entry
  // (data-rf-item) additionally narrows to that entry and scrolls its form
  // card into view. Templates tag section wrappers with data-rf-section.
  function onPreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const itemEl = target.closest<HTMLElement>("[data-rf-item]");
    const cardId = target.closest<HTMLElement>("[data-rf-section]")?.dataset
      .rfSection;
    if (!cardId) return;
    const idx = orderedCards.findIndex((c) => c.cardId === cardId);
    if (idx === -1) return;
    setCurrentCard(idx);
    if (itemEl?.dataset.rfItem != null) {
      setActiveItem(`${cardId}:${itemEl.dataset.rfItem}`);
      pendingFormScroll.current = true;
    } else {
      setActiveItem(null);
    }
    setMobileView("edit");
  }

  // One group of the desktop rail. Content cards show a completion dot or item
  // count; the active card additionally exposes move up/down (the form-card
  // order is saved per version).
  const renderRailGroup = (
    label: string,
    entries: { card: ResumeFormCardState; i: number }[],
    reorderable: boolean
  ) => (
    <div>
      <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <div className="space-y-0.5">
        {entries.map(({ card, i }, gi) => {
          const status = cardStatus(card.cardId);
          const active = i === safeCurrent;
          return (
            <div key={card.cardId}>
              <button
                type="button"
                onClick={() => goToCard(i)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className="truncate">{cardTitle(card)}</span>
                {status &&
                  (status.count ? (
                    <span
                      className={`shrink-0 rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                        active
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {status.count}
                    </span>
                  ) : status.done ? (
                    <CheckDot />
                  ) : (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full border border-input"
                      aria-hidden
                    />
                  ))}
              </button>
              {reorderable && active && (
                <div className="flex items-center gap-2 px-2.5 pb-1 pt-0.5">
                  <button
                    type="button"
                    disabled={gi === 0}
                    onClick={() => moveCard(card.cardId, -1)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↑ {t("actions.moveUp")}
                  </button>
                  <button
                    type="button"
                    disabled={gi === entries.length - 1}
                    onClick={() => moveCard(card.cardId, 1)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↓ {t("actions.moveDown")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="pb-16 lg:pb-0">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[11.5rem_minmax(0,10fr)_minmax(0,11fr)] lg:items-start lg:gap-5">
        {/* Desktop rail: section navigation, completion, and save actions. */}
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          {/* Live ATS score — the rail's headline. Opens the score panel. */}
          <button
            type="button"
            onClick={() => goToCard(atsCardIndex)}
            className={`mb-4 flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition ${
              activeCardId === "ats"
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15"
                : "border-border bg-card hover:border-brand-300 dark:hover:border-brand-400/60"
            }`}
          >
            <ScoreRing value={atsResult.overall} size={44} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground">
                {t("ats.score")}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {atsResult.hasJobDescription
                  ? t("ats.keywordsMatched", {
                      matched: atsResult.matchedCount,
                      total: atsResult.keywords.length,
                    })
                  : t("ats.addJobDescription")}
              </span>
            </span>
          </button>
          <nav aria-label={t("rail.sectionsNav")} className="space-y-4">
            {renderRailGroup(t("rail.setup"), setupEntries, false)}
            {renderRailGroup(t("rail.content"), contentEntries, true)}
          </nav>
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <button
              onClick={save}
              disabled={saving}
              className={`${buttonClass("primary")} w-full`}
            >
              {saving
                ? t("actions.saving")
                : mode === "create"
                  ? t("actions.createResume")
                  : t("actions.saveAndView")}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className={`${buttonClass("secondary")} w-full`}
            >
              {t("actions.cancel")}
            </button>
            {mode === "edit" && (
              <p className="text-center">
                <SaveStatusBadge status={saveStatus} />
              </p>
            )}
          </div>
        </aside>

        {/* Middle: the active section's form */}
        <div
          className={`min-w-0 space-y-4 lg:block ${
            mobileView === "preview" ? "hidden" : ""
          }`}
        >
        {mode === "create" && (
          <div className="rounded-xl border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t("import.title")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("import.description")}
                </p>
              </div>
              <label
                className={`shrink-0 cursor-pointer ${buttonClass("primary")} ${
                  importing ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {importing ? t("import.reading") : t("import.button")}
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    // Reset so re-selecting the same file fires onChange again.
                    e.target.value = "";
                    if (files.length) void importResume(files);
                  }}
                />
              </label>
            </div>
            {importing && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("import.parsing")}
              </p>
            )}
            {importError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{importError}</p>
            )}
            {importNote && !importError && (
              <p className="mt-2 text-xs text-green-700 dark:text-green-300">{importNote}</p>
            )}
          </div>
        )}
        {/* Mobile section switcher: a wrapping chip grid so every section is
            visible at once and fills the width (no sideways scroll). Collapsed to
            two rows by default with a "+N / chevron" expander (chipClip is
            measured so the clip lands on a row boundary, never mid-chip). The
            active section is a filled brand pill; sections that have content show
            a completion dot. Config cards (Template, Version, …) have no dot. */}
        <div className="pb-1 lg:hidden">
          <div
            ref={chipRowRef}
            className="relative flex flex-wrap gap-1.5 overflow-hidden transition-[max-height] duration-200"
            style={
              chipClip
                ? { maxHeight: sectionsExpanded ? 1000 : chipClip.maxH }
                : undefined
            }
          >
            {orderedCards.map((card, i) => {
              const active = i === safeCurrent;
              const done = Boolean(cardStatus(card.cardId)?.done);
              return (
                <button
                  key={card.cardId}
                  type="button"
                  data-section-chip
                  onClick={() => goToCard(i)}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-brand-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {cardTitle(card)}
                  {done && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        active ? "bg-white/80" : "bg-green-500"
                      }`}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
          {chipClip && (
            <button
              type="button"
              onClick={() => setSectionsExpanded((v) => !v)}
              aria-expanded={sectionsExpanded}
              className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
            >
              {!sectionsExpanded && (
                <span className="tabular-nums">+{chipClip.hidden}</span>
              )}
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`h-3.5 w-3.5 transition-transform ${
                  sectionsExpanded ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                <path
                  d="M5 8l5 5 5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
        {orderedCards.map((card, i) => {
          const content = cardContent[card.cardId];
          if (!content) return null;
          // Content-section cards (summary, areas, experience, …) can have their
          // label renamed; configuration cards (template, style, version, …) map
          // to no document section and so are not renamable.
          const sec = sectionById[card.cardId];
          // One section at a time on every screen size; the rail (desktop) and
          // the chips / bottom bar (mobile) navigate between sections.
          return (
            <div key={card.cardId} className={i === safeCurrent ? "" : "hidden"}>
              <SectionCard
                title={sec ? sectionLabel(sec) : card.title}
                count={content.count}
                headerRight={content.headerRight}
                hasCustomLabel={Boolean(sec?.customTitle)}
                footer={
                  <div className="hidden items-center justify-between gap-2 border-t border-border px-4 py-3 lg:flex">
                    <button
                      type="button"
                      disabled={!prevCardMeta}
                      onClick={() => goToCard(Math.max(0, safeCurrent - 1))}
                      className={`${buttonClass("secondary")} disabled:opacity-40`}
                    >
                      ← {prevCardMeta ? cardTitle(prevCardMeta) : t("actions.back")}
                    </button>
                    <button
                      type="button"
                      disabled={!nextCardMeta}
                      onClick={() => goToCard(Math.min(orderedCards.length - 1, safeCurrent + 1))}
                      className={`${buttonClass("primary")} disabled:opacity-40`}
                    >
                      {nextCardMeta
                        ? t("actions.next", { title: cardTitle(nextCardMeta) })
                        : t("actions.done")}{" "}
                      →
                    </button>
                  </div>
                }
              >
                {content.body}
              </SectionCard>
            </div>
          );
        })}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

        {/* Right (desktop) / below the form (mobile): live preview. On mobile it
            stacks under the form so short config panels are followed by the
            résumé instead of blank space; the bottom-bar "Preview" toggle
            collapses the form for a focused, full-height preview. */}
        <div className="lg:block lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground/80">
                {t("preview.title")}
              </p>
              <p className="hidden text-xs text-muted-foreground/70 lg:block">
                {t("preview.clickHint")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Live ATS score chip — jumps to the score panel. */}
              <button
                type="button"
                onClick={() => {
                  goToCard(atsCardIndex);
                  setMobileView("edit");
                }}
                title={t("ats.openPanel")}
                className={`hidden rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-bold tabular-nums shadow-sm lg:inline-flex ${scoreBandClass(
                  atsResult.overall
                )}`}
              >
                {t("ats.chip", { score: atsResult.overall })}
              </button>
              {/* Mobile zoom controls (desktop shows the sheet full-size). */}
              <div className="flex items-center gap-1 lg:hidden">
                <button
                  type="button"
                  aria-label={t("preview.zoomOut")}
                  onClick={() =>
                    setPreviewZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))
                  }
                  className="grid h-7 w-7 place-items-center rounded-md border border-input text-muted-foreground hover:bg-muted"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  title={t("preview.fitToWidth")}
                  className="min-w-[3rem] rounded-md border border-input px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  {previewZoom === 1 ? t("preview.fit") : `${Math.round(previewZoom * 100)}%`}
                </button>
                <button
                  type="button"
                  aria-label={t("preview.zoomIn")}
                  onClick={() =>
                    setPreviewZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
                  }
                  className="grid h-7 w-7 place-items-center rounded-md border border-input text-muted-foreground hover:bg-muted"
                >
                  +
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={atsView}
                  onChange={(e) => setAtsView(e.target.checked)}
                  aria-label={t("ats.safeView")}
                  className="h-3.5 w-3.5"
                />
                {/* Full label on desktop; a short "ATS" marker on mobile to keep
                    the inline preview header from crowding. */}
                <span className="hidden lg:inline">{t("ats.safeView")}</span>
                <span className="lg:hidden">ATS</span>
              </label>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
            <div
              ref={previewRef}
              className="rf-click-edit max-h-[80vh] overflow-auto p-3"
              onClick={onPreviewClick}
            >
              <A4Preview
                key={mobileView}
                margins={templateStyle.pageMargins}
                zoom={previewZoom}
              >
                <ResumeTemplateRenderer
                  resumeData={data}
                  selectedTemplate={template}
                  style={templateStyle}
                  sectionState={sectionState}
                  atsSafe={atsView}
                />
              </A4Preview>
            </div>
          </div>
        </div>

        {/* Mobile save actions; on desktop these live in the rail. Placed after
            the preview so the flow reads form → live preview → save. */}
        <div className="flex items-center gap-2 lg:hidden">
          <button onClick={save} disabled={saving} className={buttonClass("primary")}>
            {saving
              ? t("actions.saving")
              : mode === "create"
                ? t("actions.createResume")
                : t("actions.saveAndView")}
          </button>
          <button
            onClick={() => router.back()}
            className={buttonClass("secondary")}
            type="button"
          >
            {t("actions.cancel")}
          </button>
        </div>
      </div>

      {/* Mobile bottom action bar: pane switch, section stepping, save state.
          Fixed so thumbs never have to travel; the root pads for it (pb-16). */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setMobileView("edit")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mobileView === "edit"
                  ? "bg-card text-brand-700 dark:text-brand-300 shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t("mobile.edit")}
            </button>
            <button
              type="button"
              onClick={() => setMobileView("preview")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mobileView === "preview"
                  ? "bg-card text-brand-700 dark:text-brand-300 shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t("mobile.preview")}
            </button>
          </div>

          {mobileView === "edit" ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t("mobile.prevSection")}
                disabled={safeCurrent === 0}
                onClick={() => goToCard(Math.max(0, safeCurrent - 1))}
                className="grid h-9 w-9 place-items-center rounded-md border border-input text-foreground/80 disabled:opacity-40"
              >
                ←
              </button>
              <span className="min-w-[3rem] text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                {safeCurrent + 1} / {orderedCards.length}
              </span>
              <button
                type="button"
                aria-label={t("mobile.nextSection")}
                disabled={safeCurrent >= orderedCards.length - 1}
                onClick={() => goToCard(Math.min(orderedCards.length - 1, safeCurrent + 1))}
                className="grid h-9 w-9 place-items-center rounded-md bg-brand-600 text-white disabled:opacity-40"
              >
                →
              </button>
            </div>
          ) : (
            <span className="truncate text-xs text-muted-foreground">
              {t("mobile.tapToEdit")}
            </span>
          )}

          <div className="min-w-[3.5rem] text-right">
            {mode === "edit" && <SaveStatusBadge status={saveStatus} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// Small autosave indicator. "idle" renders nothing (no edits yet this session).
function SaveStatusBadge({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  const t = useTranslations("builder");
  if (status === "idle") return null;
  const map = {
    saving: { text: t("autosave.saving"), cls: "text-muted-foreground/70" },
    saved: { text: t("autosave.saved"), cls: "text-green-600 dark:text-green-400" },
    error: { text: t("autosave.error"), cls: "text-red-600 dark:text-red-400" },
  } as const;
  const { text, cls } = map[status];
  return <span className={`text-xs font-medium ${cls}`}>{text}</span>;
}

// The card framing the active section's form: title header (with optional
// count / renamed marker and per-card actions) and an optional footer used for
// the desktop Back / Next flow. Navigation between cards lives in the rail
// (desktop) and the chip bar + bottom bar (mobile).
function SectionCard({
  title,
  count,
  headerRight,
  hasCustomLabel,
  footer,
  children,
}: {
  title: string;
  count?: number;
  headerRight?: React.ReactNode;
  hasCustomLabel?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("builder");
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
          {hasCustomLabel && (
            <span className="ml-1 text-xs font-normal text-muted-foreground/70">
              {t("sections.renamed")}
            </span>
          )}
          {typeof count === "number" && count > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground/70">
              ({count})
            </span>
          )}
        </h2>
        <div className="flex shrink-0 items-center gap-1">{headerRight}</div>
      </div>
      <div className="p-4">{children}</div>
      {footer}
    </div>
  );
}

// Small green check shown in the rail next to completed sections.
function CheckDot() {
  return (
    <span
      className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400"
      aria-hidden
    >
      <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

// Item-by-item editor for Areas of Expertise: add, edit inline, reorder, remove,
// and choose a bullet marker style.
function AreasOfExpertiseEditor({
  items,
  bulletStyle,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onBulletStyleChange,
}: {
  items: string[];
  bulletStyle: ResumeBulletStyle;
  onAdd: (value: string) => void;
  onUpdate: (i: number, value: string) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onBulletStyleChange: (v: ResumeBulletStyle) => void;
}) {
  const t = useTranslations("builder");
  const [draft, setDraft] = useState("");
  function commitDraft() {
    onAdd(draft);
    setDraft("");
  }
  return (
    <div>
      <div className="mb-3 max-w-xs">
        <label className={labelClass}>{t("areas.bulletStyle")}</label>
        <select
          className={inputClass}
          value={bulletStyle}
          onChange={(e) => onBulletStyleChange(e.target.value as ResumeBulletStyle)}
        >
          {BULLET_STYLE_OPTIONS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={inputClass}
              value={item}
              onChange={(e) => onUpdate(i, e.target.value)}
              placeholder={t("areas.itemPlaceholder")}
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label={t("actions.moveUp")}
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label={t("actions.moveDown")}
                disabled={i === items.length - 1}
                onClick={() => onMove(i, 1)}
              >
                ↓
              </IconButton>
              <IconButton label={t("actions.remove")} danger onClick={() => onRemove(i)}>
                ✕
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      {/* One-by-one entry */}
      <div className="mt-3 flex items-center gap-2">
        <input
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
          placeholder={t("areas.addPlaceholder")}
        />
        <button
          type="button"
          onClick={commitDraft}
          className="shrink-0 rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          {t("actions.add")}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground/70">
        {t("areas.hint")}
      </p>
    </div>
  );
}

// Technical Skills editor: Category / Value rows (e.g. "Mainframe" → "COBOL,
// JCL"). Add, edit inline, reorder, and remove rows. Leaving the category blank
// renders the value on its own line.
function SkillCategoryEditor({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: {
  items: CustomSectionItem[];
  onAdd: () => void;
  onUpdate: (i: number, patch: Partial<CustomSectionItem>) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
}) {
  const t = useTranslations("builder");
  return (
    <div>
      {items.length > 0 && (
        <div className="mb-1 flex items-center gap-2">
          <span className="flex-1 text-xs font-medium text-muted-foreground sm:max-w-[40%]">
            {t("skills.category")}
          </span>
          <span className="flex-1 text-xs font-medium text-muted-foreground">{t("skills.value")}</span>
          <span className="w-[104px] shrink-0" />
        </div>
      )}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={`${inputClass} min-w-0 flex-1 sm:max-w-[40%]`}
              value={item.category}
              onChange={(e) => onUpdate(i, { category: e.target.value })}
              placeholder={t("skills.categoryPlaceholder")}
            />
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={item.value}
              onChange={(e) => onUpdate(i, { value: e.target.value })}
              placeholder={t("skills.valuePlaceholder")}
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label={t("actions.moveUp")}
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label={t("actions.moveDown")}
                disabled={i === items.length - 1}
                onClick={() => onMove(i, 1)}
              >
                ↓
              </IconButton>
              <IconButton label={t("actions.remove")} danger onClick={() => onRemove(i)}>
                ✕
              </IconButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          {t("actions.addItem")}
        </button>
      </div>
    </div>
  );
}

// Reorder + show/hide the document sections. Unlike the form-card layout (which
// only affects the builder), this controls the rendered resume: the order and
// visibility here flow into the live preview and the PDF/DOCX/PPTX exports.
// Default and custom sections live in one ordered list and reorder together.
function SectionLayoutEditor({
  entries,
  sectionById,
  onMove,
  onToggleVisible,
  onTogglePageBreak,
  onRename,
  onResetLabel,
}: {
  entries: DocSectionEntry[];
  sectionById: Record<string, ResumeSectionState>;
  onMove: (kind: DocSectionEntry["kind"], id: string, dir: -1 | 1) => void;
  onToggleVisible: (kind: DocSectionEntry["kind"], id: string) => void;
  onTogglePageBreak: (kind: DocSectionEntry["kind"], id: string) => void;
  // Rename one of the fixed document sections. A blank value resets it to the
  // default. Custom sections rename via their own card, so they are not editable
  // here.
  onRename: (sectionId: string, value: string) => void;
  onResetLabel: (sectionId: string) => void;
}) {
  const t = useTranslations("builder");
  const entryId = (e: DocSectionEntry) =>
    e.kind === "default" ? e.sectionId : e.id;
  // Which fixed section (by id) is currently being renamed, and the draft label.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startEdit(sectionId: string, current: string) {
    setDraft(current);
    setEditingId(sectionId);
  }
  function commit(sectionId: string) {
    onRename(sectionId, draft);
    setEditingId(null);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground/70">
        {t("sections.intro")}
      </p>
      <div className="space-y-2">
        {entries.map((e, i) => {
          const id = entryId(e);
          // Only the fixed sections rename here; custom-section titles are edited
          // in the Custom Sections card.
          const renamable = e.kind === "default";
          const sec = renamable ? sectionById[id] : undefined;
          const hasCustomLabel = Boolean(sec?.customTitle);
          const isEditing = editingId === id;
          return (
            <div
              key={`${e.kind}:${id}`}
              className="rounded-lg border border-border bg-muted/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span
                  className={`truncate text-sm font-medium ${
                    e.visible ? "text-foreground/80" : "text-muted-foreground/70 line-through"
                  }`}
                >
                  {e.label}
                  {e.kind === "custom" && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground/70">
                      {t("sections.custom")}
                    </span>
                  )}
                  {hasCustomLabel && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground/70">
                      {t("sections.renamed")}
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={e.visible}
                      onChange={() => onToggleVisible(e.kind, id)}
                      className="h-3.5 w-3.5"
                    />
                    {t("sections.show")}
                  </label>
                  <label className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={e.pageBreakAfter}
                      onChange={() => onTogglePageBreak(e.kind, id)}
                      className="h-3.5 w-3.5"
                    />
                    {t("sections.breakAfter")}
                  </label>
                  {renamable && (
                    <IconButton
                      label={t("sections.rename", { label: e.label })}
                      onClick={() =>
                        isEditing ? setEditingId(null) : startEdit(id, e.label)
                      }
                    >
                      ✎
                    </IconButton>
                  )}
                  <IconButton
                    label={t("sections.moveUp")}
                    disabled={i === 0}
                    onClick={() => onMove(e.kind, id, -1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label={t("sections.moveDown")}
                    disabled={i === entries.length - 1}
                    onClick={() => onMove(e.kind, id, 1)}
                  >
                    ↓
                  </IconButton>
                </div>
              </div>
              {isEditing && renamable && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
                  <input
                    autoFocus
                    className={`${inputClass} flex-1`}
                    value={draft}
                    onChange={(ev) => setDraft(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") {
                        ev.preventDefault();
                        commit(id);
                      } else if (ev.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    placeholder={
                      sec?.defaultTitle
                        ? t("sections.defaultPlaceholder", {
                            title: sec.defaultTitle,
                          })
                        : t("sections.namePlaceholder")
                    }
                  />
                  <button
                    type="button"
                    onClick={() => commit(id)}
                    className="rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                  >
                    {t("actions.save")}
                  </button>
                  {hasCustomLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        onResetLabel(id);
                        setEditingId(null);
                      }}
                      className="text-xs text-muted-foreground/70 hover:text-brand-600 dark:hover:text-brand-300"
                    >
                      {t("actions.resetToDefault")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-muted-foreground/70 hover:text-foreground/80"
                  >
                    {t("actions.cancel")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Create + edit custom sections: title, layout type, content (per layout), and
// show/hide + collapse. Reordering and the document-level show/hide happen in
// the "Document Sections" card; this card owns content and per-section settings.
function CustomSectionsEditor({
  sections,
  onAdd,
  onUpdate,
  onDelete,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onMoveItem,
}: {
  sections: CustomSection[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<CustomSection>) => void;
  onDelete: (id: string) => void;
  onAddItem: (id: string, item: CustomSectionItem) => void;
  onUpdateItem: (
    id: string,
    idx: number,
    patch: Partial<CustomSectionItem>
  ) => void;
  onRemoveItem: (id: string, idx: number) => void;
  onMoveItem: (id: string, idx: number, dir: -1 | 1) => void;
}) {
  const t = useTranslations("builder");
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground/70">
        {t("custom.intro")}
      </p>
      <div className="space-y-3">
        {sections.map((section) => (
          <CustomSectionCard
            key={section.id}
            section={section}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAddItem={onAddItem}
            onUpdateItem={onUpdateItem}
            onRemoveItem={onRemoveItem}
            onMoveItem={onMoveItem}
          />
        ))}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border border-dashed border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          {t("custom.addSection")}
        </button>
      </div>
    </div>
  );
}

// One custom section's editor: header (collapse, title, layout, show/hide,
// delete) plus a layout-specific content editor.
function CustomSectionCard({
  section,
  onUpdate,
  onDelete,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onMoveItem,
}: {
  section: CustomSection;
  onUpdate: (id: string, patch: Partial<CustomSection>) => void;
  onDelete: (id: string) => void;
  onAddItem: (id: string, item: CustomSectionItem) => void;
  onUpdateItem: (
    id: string,
    idx: number,
    patch: Partial<CustomSectionItem>
  ) => void;
  onRemoveItem: (id: string, idx: number) => void;
  onMoveItem: (id: string, idx: number, dir: -1 | 1) => void;
}) {
  const t = useTranslations("builder");
  const { id } = section;
  const isBulleted =
    section.layoutType === "bullets" ||
    section.layoutType === "twoColumnBullets";
  return (
    <div className="rounded-lg border border-border bg-muted/50">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => onUpdate(id, { collapsed: !section.collapsed })}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!section.collapsed}
        >
          <span
            className="text-muted-foreground/70"
            aria-hidden
            style={{ transform: section.collapsed ? "rotate(-90deg)" : "none" }}
          >
            ▾
          </span>
          <span className="truncate text-sm font-semibold text-foreground/80">
            {customSectionLabel(section)}
            {!section.visible && (
              <span className="ml-1 text-xs font-normal text-muted-foreground/70">
                {t("custom.hidden")}
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={section.visible}
              onChange={() => onUpdate(id, { visible: !section.visible })}
              className="h-3.5 w-3.5"
            />
            {t("custom.showInResume")}
          </label>
          <button
            type="button"
            onClick={() => onDelete(id)}
            className="rounded-md border border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:border-red-200 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400"
          >
            {t("custom.deleteSection")}
          </button>
        </div>
      </div>

      {!section.collapsed && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("custom.sectionTitle")}</label>
              <input
                className={inputClass}
                value={section.title}
                onChange={(e) => onUpdate(id, { title: e.target.value })}
                placeholder={t("custom.sectionTitlePlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>{t("custom.layoutType")}</label>
              <select
                className={inputClass}
                value={section.layoutType}
                onChange={(e) =>
                  onUpdate(id, {
                    layoutType: e.target.value as CustomSectionLayoutType,
                  })
                }
              >
                {CUSTOM_LAYOUT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isBulleted && (
            <div className="max-w-xs">
              <label className={labelClass}>{t("custom.bulletStyle")}</label>
              <select
                className={inputClass}
                value={section.bulletStyle}
                onChange={(e) =>
                  onUpdate(id, {
                    bulletStyle: e.target.value as ResumeBulletStyle,
                  })
                }
              >
                {BULLET_STYLE_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {section.layoutType === "freeText" ? (
            <div>
              <label className={labelClass}>{t("custom.content")}</label>
              <textarea
                className={inputClass}
                rows={4}
                value={section.freeText}
                onChange={(e) => onUpdate(id, { freeText: e.target.value })}
                placeholder={t("custom.freeTextPlaceholder")}
              />
            </div>
          ) : section.layoutType === "categoryValue" ? (
            <CategoryValueEditor
              section={section}
              onAddItem={onAddItem}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
              onMoveItem={onMoveItem}
            />
          ) : (
            <BulletItemsEditor
              section={section}
              onAddItem={onAddItem}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
              onMoveItem={onMoveItem}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Item-by-item editor for bullets / two-column bullets: add, edit inline,
// reorder, remove. Each item's text lives in `value`.
function BulletItemsEditor({
  section,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onMoveItem,
}: {
  section: CustomSection;
  onAddItem: (id: string, item: CustomSectionItem) => void;
  onUpdateItem: (
    id: string,
    idx: number,
    patch: Partial<CustomSectionItem>
  ) => void;
  onRemoveItem: (id: string, idx: number) => void;
  onMoveItem: (id: string, idx: number, dir: -1 | 1) => void;
}) {
  const t = useTranslations("builder");
  const [draft, setDraft] = useState("");
  function commit() {
    const text = draft.trim();
    if (!text) return;
    onAddItem(section.id, { category: "", value: text });
    setDraft("");
  }
  const items = section.items ?? [];
  return (
    <div>
      {items.length > 0 && <label className={labelClass}>{t("custom.items")}</label>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground/70">
              {i + 1}.
            </span>
            <input
              className={inputClass}
              value={item.value}
              onChange={(e) =>
                onUpdateItem(section.id, i, { value: e.target.value })
              }
              placeholder={t("custom.bulletPlaceholder")}
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label={t("actions.moveUp")}
                disabled={i === 0}
                onClick={() => onMoveItem(section.id, i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label={t("actions.moveDown")}
                disabled={i === items.length - 1}
                onClick={() => onMoveItem(section.id, i, 1)}
              >
                ↓
              </IconButton>
              <IconButton
                label={t("actions.remove")}
                danger
                onClick={() => onRemoveItem(section.id, i)}
              >
                ✕
              </IconButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={t("custom.addItemPlaceholder")}
        />
        <button
          type="button"
          onClick={commit}
          className="shrink-0 rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          {t("actions.addItem")}
        </button>
      </div>
    </div>
  );
}

// Row-by-row editor for the category / value layout. Each row has a category
// (label) and a value.
function CategoryValueEditor({
  section,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onMoveItem,
}: {
  section: CustomSection;
  onAddItem: (id: string, item: CustomSectionItem) => void;
  onUpdateItem: (
    id: string,
    idx: number,
    patch: Partial<CustomSectionItem>
  ) => void;
  onRemoveItem: (id: string, idx: number) => void;
  onMoveItem: (id: string, idx: number, dir: -1 | 1) => void;
}) {
  const t = useTranslations("builder");
  const items = section.items ?? [];
  return (
    <div>
      {items.length > 0 && <label className={labelClass}>{t("custom.items")}</label>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground/70">
              {i + 1}.
            </span>
            <input
              className={`${inputClass} min-w-0 flex-1 sm:max-w-[40%]`}
              value={item.category}
              onChange={(e) =>
                onUpdateItem(section.id, i, { category: e.target.value })
              }
              placeholder={t("custom.categoryPlaceholder")}
            />
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={item.value}
              onChange={(e) =>
                onUpdateItem(section.id, i, { value: e.target.value })
              }
              placeholder={t("custom.valuePlaceholder")}
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label={t("actions.moveUp")}
                disabled={i === 0}
                onClick={() => onMoveItem(section.id, i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label={t("actions.moveDown")}
                disabled={i === items.length - 1}
                onClick={() => onMoveItem(section.id, i, 1)}
              >
                ↓
              </IconButton>
              <IconButton
                label={t("actions.remove")}
                danger
                onClick={() => onRemoveItem(section.id, i)}
              >
                ✕
              </IconButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onAddItem(section.id, { category: "", value: "" })}
          className="rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          {t("actions.addItem")}
        </button>
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-md border border-input text-sm text-muted-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "hover:border-red-200 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400" : ""
      }`}
    >
      {children}
    </button>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("builder");
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
    >
      {t("actions.add")}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// A labelled range slider with a live value badge. All style controls use this
// instead of bare numeric inputs so changes can be scrubbed against the live
// preview.
function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/80">
          {display ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-2 w-full cursor-pointer accent-brand-600"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-input bg-card p-0.5"
          aria-label={label}
        />
        <input
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// A collapsible list entry (one job / degree / project). Collapsed it shows a
// one-line summary header; expanded it shows the edit fields. Expansion is
// accordion-style and shares state with the preview's item highlight: the
// expanded entry IS the activeItem, so preview clicks expand exactly it.
function ItemCard({
  children,
  onRemove,
  dataKey,
  onActive,
  summary,
  detail,
  expanded,
  onToggle,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  // "cardId:index" identity for preview↔form item linking: the preview's
  // click-to-edit scrolls to this card via data-rf-form-item, and onActive
  // fires when the user works in this entry so the preview narrows to it.
  dataKey?: string;
  onActive?: () => void;
  // Collapsed-state header line (e.g. "Role · Company") plus an optional
  // muted right-hand detail (e.g. the date range).
  summary: string;
  detail?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("builder");
  return (
    <div
      className="rounded-lg border border-border bg-muted/50"
      data-rf-form-item={dataKey}
      onFocusCapture={onActive}
      onClickCapture={onActive}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className="text-xs text-muted-foreground/70 transition-transform"
            style={{ transform: expanded ? "none" : "rotate(-90deg)" }}
            aria-hidden
          >
            ▾
          </span>
          <span className="truncate text-sm font-medium text-foreground/80">
            {summary}
          </span>
          {detail && (
            <span className="hidden shrink-0 text-xs text-muted-foreground/70 sm:block">
              {detail}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400"
        >
          {t("actions.remove")}
        </button>
      </div>
      {expanded && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}
