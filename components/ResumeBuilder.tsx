"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { buttonClass } from "./ui";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

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
  // Mobile preview zoom (1 = fit to screen width). Desktop ignores this.
  const [previewZoom, setPreviewZoom] = useState(1);
  // Mobile stepper: which form card (section) is in focus. Desktop shows all.
  const [currentCard, setCurrentCard] = useState(0);
  // Autosave status (edit mode only).
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  // Skip the autosave that the initialization render would otherwise trigger.
  const skipFirstAutosave = useRef(true);

  // ----- Form card layout (collapse + drag-to-reorder) -----
  function toggleCollapse(cardId: string) {
    setFormCards((cards) =>
      cards.map((c) =>
        c.cardId === cardId ? { ...c, collapsed: !c.collapsed } : c
      )
    );
  }
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
      if (!res.ok) throw new Error("Photo upload failed");
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
      setError(err instanceof Error ? err.message : "Photo upload failed");
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

  // Upload a resume file, parse it with AI, and replace the builder contents
  // with the extracted data. Also seeds a sensible version name / target role
  // from the parsed identity when those are still blank.
  async function importResume(file: File) {
    setImporting(true);
    setImportError("");
    setImportNote("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resumes/import", {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Import failed");
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
      setImportNote(
        "Imported. Review the sections below, then press “Create resume” to save."
      );
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
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
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      router.push(`/resumes/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
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
          Reset to default
        </button>
      ),
      body: (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Font</label>
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
            <div>
              <label className={labelClass}>Body text size (px)</label>
              <input
                type="number"
                min={8}
                max={24}
                step={0.5}
                className={inputClass}
                value={templateStyle.fontSize}
                onChange={(e) =>
                  patchStyle(
                    "fontSize",
                    Math.max(
                      8,
                      Math.min(
                        24,
                        Number.isFinite(e.target.valueAsNumber)
                          ? e.target.valueAsNumber
                          : 13
                      )
                    )
                  )
                }
              />
            </div>
            <div>
              <label className={labelClass}>Name size (×)</label>
              <input
                type="number"
                min={0.8}
                max={4}
                step={0.05}
                className={inputClass}
                value={templateStyle.fontScale.name}
                onChange={(e) => patchScale("name", e.target.valueAsNumber)}
              />
            </div>
            <div>
              <label className={labelClass}>Heading size (×)</label>
              <input
                type="number"
                min={0.8}
                max={4}
                step={0.05}
                className={inputClass}
                value={templateStyle.fontScale.heading}
                onChange={(e) => patchScale("heading", e.target.valueAsNumber)}
              />
            </div>
            <ColorField
              label="Primary color"
              value={templateStyle.primaryColor}
              onChange={(v) => patchStyle("primaryColor", v)}
            />
            <ColorField
              label="Body text color"
              value={templateStyle.bodyColor}
              onChange={(v) => patchStyle("bodyColor", v)}
            />
            <ColorField
              label="Muted text color"
              value={templateStyle.mutedColor}
              onChange={(v) => patchStyle("mutedColor", v)}
            />
            <ColorField
              label="Section line color"
              value={templateStyle.sectionLineColor}
              onChange={(v) => patchStyle("sectionLineColor", v)}
            />
          </div>
          <div className="mt-4">
            <label className={labelClass}>Page margins (mm)</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <div key={side}>
                  <span className="mb-1 block text-xs capitalize text-muted-foreground">
                    {side}
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
          </div>
          <div className="mt-4">
            <label className={labelClass}>Line spacing</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  { key: "section", label: "Section gap (rem)", step: 0.1 },
                  { key: "text", label: "Text line height", step: 0.05 },
                  { key: "bullet", label: "Bullet gap (rem)", step: 0.05 },
                ] as const
              ).map(({ key, label, step }) => (
                <div key={key}>
                  <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
                  <input
                    type="number"
                    min={key === "text" ? 0.8 : 0}
                    max={3}
                    step={step}
                    className={inputClass}
                    value={templateStyle.lineSpacing[key]}
                    onChange={(e) => patchSpacing(key, e.target.valueAsNumber)}
                  />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Applied live to the preview and saved with this version. Margins set
            the printed A4 page margins (and the on-screen sheet padding). The
            ATS Corporate Style template uses every setting; other templates use
            the font and primary color.
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
            <label className={labelClass}>Version name</label>
            <input
              className={inputClass}
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g. Backend Engineer v2"
            />
          </div>
          <div>
            <label className={labelClass}>Target role</label>
            <input
              className={inputClass}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
            />
          </div>
        </div>
      ),
    },
    basics: {
      body: (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={data.basics.name} onChange={(v) => patchBasics("name", v)} />
            <Field label="Headline / title" value={data.basics.title} onChange={(v) => patchBasics("title", v)} />
            <Field label="Email" value={data.basics.email} onChange={(v) => patchBasics("email", v)} />
            <Field label="Phone" value={data.basics.phone} onChange={(v) => patchBasics("phone", v)} />
            <Field label="Location" value={data.basics.location} onChange={(v) => patchBasics("location", v)} />
            <Field label="Website" value={data.basics.website} onChange={(v) => patchBasics("website", v)} />
          </div>

          {/* Profile photo */}
          <div className="mt-3">
            <label className={labelClass}>Profile photo</label>
            <div className="flex items-center gap-3">
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoSrc}
                  alt="Profile preview"
                  className={`h-16 w-16 border border-border object-cover ${
                    photoShape === "circle" ? "rounded-full" : "rounded-md"
                  }`}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-input text-[10px] text-muted-foreground/70">
                  No photo
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                  {uploadingPhoto
                    ? "Uploading…"
                    : photoSrc
                      ? "Change photo"
                      : "Upload photo"}
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
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            {/* Shape choice (ATS Corporate Style template). Shown once a photo is present. */}
            {photoSrc && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Shape:</span>
                <div className="inline-flex overflow-hidden rounded-md border border-input">
                  {(["square", "circle"] as const).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() =>
                        setData((d) => ({ ...d, profilePhotoShape: shape }))
                      }
                      className={`px-2.5 py-1 text-xs font-medium capitalize ${
                        photoShape === shape
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground/70">
              Saved as an image in your Google Drive app data (only the file
              reference is kept in the resume). Shown in the ATS Corporate Style
              template header. In local dev mode it is embedded as Base64.
            </p>
          </div>
        </>
      ),
    },
    summary: {
      body: (
        <div>
          <label className={labelClass}>Professional summary</label>
          <RichTextEditor
            value={data.basics.summary}
            onChange={(html) => patchBasics("summary", html)}
            placeholder="2-3 sentences summarizing your experience and strengths."
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
      headerRight: <AddButton onClick={addExperience} />,
      body: (
        <div className="space-y-3">
          {data.experience.map((exp, i) => (
            <ItemCard key={i} onRemove={() => removeExperience(i)}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Role" value={exp.role} onChange={(v) => updateExperience(i, { role: v })} />
                <Field label="Company" value={exp.company} onChange={(v) => updateExperience(i, { company: v })} />
                <Field label="Location" value={exp.location} onChange={(v) => updateExperience(i, { location: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start" value={exp.startDate} onChange={(v) => updateExperience(i, { startDate: v })} />
                  <Field label="End" value={exp.endDate} onChange={(v) => updateExperience(i, { endDate: v })} />
                </div>
              </div>
              <div className="mt-2">
                <label className={labelClass}>Highlights (one bullet per line)</label>
                <RichTextEditor
                  value={linesToHtml(exp.highlights)}
                  onChange={(html) =>
                    updateExperience(i, { highlights: htmlToLines(html) })
                  }
                  showLists={false}
                  hint="One bullet per line — Enter adds a bullet"
                  placeholder="Key achievements, one per line"
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
          ))}
        </div>
      ),
    },
    education: {
      count: data.education.length,
      headerRight: <AddButton onClick={addEducation} />,
      body: (
        <div className="space-y-3">
          {data.education.map((ed, i) => (
            <ItemCard key={i} onRemove={() => removeEducation(i)}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="School" value={ed.school} onChange={(v) => updateEducation(i, { school: v })} />
                <Field label="Degree" value={ed.degree} onChange={(v) => updateEducation(i, { degree: v })} />
                <Field label="Field" value={ed.field} onChange={(v) => updateEducation(i, { field: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start" value={ed.startDate} onChange={(v) => updateEducation(i, { startDate: v })} />
                  <Field label="End" value={ed.endDate} onChange={(v) => updateEducation(i, { endDate: v })} />
                </div>
              </div>
            </ItemCard>
          ))}
        </div>
      ),
    },
    projects: {
      count: data.projects.length,
      headerRight: <AddButton onClick={addProject} />,
      body: (
        <div className="space-y-3">
          {data.projects.map((p, i) => (
            <ItemCard key={i} onRemove={() => removeProject(i)}>
              <div className="grid gap-2">
                <Field label="Name" value={p.name} onChange={(v) => updateProject(i, { name: v })} />
                <Field label="Link" value={p.link} onChange={(v) => updateProject(i, { link: v })} />
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={p.description}
                    onChange={(e) => updateProject(i, { description: e.target.value })}
                  />
                </div>
              </div>
            </ItemCard>
          ))}
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
          <label className={labelClass}>Certifications (one per line)</label>
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
          <label className={labelClass}>Languages (one per line)</label>
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

  return (
    <div>
      {/* Mobile tab switcher: edit vs. preview. Hidden on large screens where
          both panes show side-by-side. Sticky so you can flip back to Edit
          while scrolled down in the preview. */}
      <div className="sticky top-16 z-20 mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView("edit")}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
            mobileView === "edit"
              ? "bg-card text-brand-700 dark:text-brand-300 shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
            mobileView === "preview"
              ? "bg-card text-brand-700 dark:text-brand-300 shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Preview
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: ordered, collapsible, draggable form cards */}
        <div
          className={`space-y-4 lg:col-span-2 lg:block ${
            mobileView === "preview" ? "hidden" : ""
          }`}
        >
        {mode === "create" && (
          <div className="rounded-xl border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Start from an existing resume
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upload a PDF or Word (.docx) file and AI will sort it into the
                  sections below. Nothing is saved until you press “Create
                  resume”.
                </p>
              </div>
              <label
                className={`shrink-0 cursor-pointer ${buttonClass("primary")} ${
                  importing ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {importing ? "Reading…" : "Import file"}
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    // Reset so re-selecting the same file fires onChange again.
                    e.target.value = "";
                    if (file) void importResume(file);
                  }}
                />
              </label>
            </div>
            {importing && (
              <p className="mt-2 text-xs text-muted-foreground">
                Parsing and categorizing with AI — this can take a few seconds.
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
        {/* Mobile section stepper: tappable chip bar (one section at a time). */}
        <div className="lg:hidden">
          <div className="-mx-1 flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-semibold text-muted-foreground">
              Section {safeCurrent + 1} of {orderedCards.length}
            </p>
            {mode === "edit" && <SaveStatusBadge status={saveStatus} />}
          </div>
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1.5">
            {orderedCards.map((card, i) => (
              <button
                key={card.cardId}
                type="button"
                onClick={() => setCurrentCard(i)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  i === safeCurrent
                    ? "bg-brand-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted"
                }`}
              >
                {cardTitle(card)}
              </button>
            ))}
          </div>
        </div>

        <p className="hidden text-xs text-muted-foreground/70 lg:block">
          Use the ↑ ↓ controls to reorder cards, or click a card header to
          collapse it. Your layout is saved with this version and only affects
          the form — not the resume output.
        </p>
        {orderedCards.map((card, i) => {
          const content = cardContent[card.cardId];
          if (!content) return null;
          // Content-section cards (summary, areas, experience, …) can have their
          // label renamed; configuration cards (template, style, version, …) map
          // to no document section and so are not renamable.
          const sec = sectionById[card.cardId];
          // On mobile only the focused section shows; desktop shows every card.
          return (
            <div
              key={card.cardId}
              className={i === safeCurrent ? "" : "hidden lg:block"}
            >
              <CollapsibleCard
                card={card}
                count={content.count}
                headerRight={content.headerRight}
                isFirst={i === 0}
                isLast={i === orderedCards.length - 1}
                onToggle={() => toggleCollapse(card.cardId)}
                onMoveUp={() => moveCard(card.cardId, -1)}
                onMoveDown={() => moveCard(card.cardId, 1)}
                displayTitle={sec ? sectionLabel(sec) : undefined}
                hasCustomLabel={Boolean(sec?.customTitle)}
              >
                {content.body}
              </CollapsibleCard>
            </div>
          );
        })}

        {/* Mobile Back / Next stepper controls. */}
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <button
            type="button"
            disabled={safeCurrent === 0}
            onClick={() => setCurrentCard((c) => Math.max(0, c - 1))}
            className={`${buttonClass("secondary")} disabled:opacity-40`}
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={safeCurrent >= orderedCards.length - 1}
            onClick={() =>
              setCurrentCard((c) => Math.min(orderedCards.length - 1, c + 1))
            }
            className={`${buttonClass("primary")} disabled:opacity-40`}
          >
            Next →
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving} className={buttonClass("primary")}>
            {saving ? "Saving…" : mode === "create" ? "Create resume" : "Save & view"}
          </button>
          <button
            onClick={() => router.back()}
            className={buttonClass("secondary")}
            type="button"
          >
            Cancel
          </button>
          {mode === "edit" && (
            <span className="hidden lg:block">
              <SaveStatusBadge status={saveStatus} />
            </span>
          )}
        </div>
      </div>

        {/* Right: live preview */}
        <div
          className={`lg:col-span-3 lg:block lg:sticky lg:top-20 lg:self-start ${
            mobileView === "edit" ? "hidden" : ""
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground/80">Live preview</p>
            <div className="flex items-center gap-2">
              {/* Mobile zoom controls (desktop shows the sheet full-size). */}
              <div className="flex items-center gap-1 lg:hidden">
                <button
                  type="button"
                  aria-label="Zoom out"
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
                  title="Fit to width"
                  className="min-w-[3rem] rounded-md border border-input px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  {previewZoom === 1 ? "Fit" : `${Math.round(previewZoom * 100)}%`}
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
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
                  className="h-3.5 w-3.5"
                />
                ATS-safe view
              </label>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
            <div className="max-h-[80vh] overflow-auto p-3">
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
  if (status === "idle") return null;
  const map = {
    saving: { text: "Saving…", cls: "text-muted-foreground/70" },
    saved: { text: "Saved ✓", cls: "text-green-600 dark:text-green-400" },
    error: { text: "Couldn’t save", cls: "text-red-600 dark:text-red-400" },
  } as const;
  const { text, cls } = map[status];
  return <span className={`text-xs font-medium ${cls}`}>{text}</span>;
}

// A form card with a header that toggles collapse, plus up/down controls for
// reordering. The title + caret collapse the card; the ↑ ↓ buttons move it.
function CollapsibleCard({
  card,
  count,
  headerRight,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
  displayTitle,
  hasCustomLabel,
  children,
}: {
  card: ResumeFormCardState;
  count?: number;
  headerRight?: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  // For content-section cards: the resolved label shown in the header
  // (customTitle || defaultTitle) and whether a custom label is set, so the
  // header reflects renames done in the Document Sections card. Absent for
  // configuration cards. Renaming itself lives in SectionLayoutEditor.
  displayTitle?: string;
  hasCustomLabel?: boolean;
  children: React.ReactNode;
}) {
  // Section cards show their (possibly custom) label; other cards keep the
  // canonical card title.
  const title = displayTitle ?? card.title;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!card.collapsed}
        >
          <span
            className="text-muted-foreground/70 transition-transform"
            aria-hidden
            style={{ transform: card.collapsed ? "rotate(-90deg)" : "none" }}
          >
            ▾
          </span>
          <span className="truncate text-sm font-semibold text-foreground/80">
            {title}
            {hasCustomLabel && (
              <span className="ml-1 text-xs font-normal text-muted-foreground/70">
                (renamed)
              </span>
            )}
            {typeof count === "number" && (
              <span className="ml-1 text-xs font-normal text-muted-foreground/70">
                ({count})
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {headerRight}
          <IconButton label="Move card up" disabled={isFirst} onClick={onMoveUp}>
            ↑
          </IconButton>
          <IconButton
            label="Move card down"
            disabled={isLast}
            onClick={onMoveDown}
          >
            ↓
          </IconButton>
        </div>
      </div>
      {!card.collapsed && <div className="px-4 pb-4">{children}</div>}
    </div>
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
  const [draft, setDraft] = useState("");
  function commitDraft() {
    onAdd(draft);
    setDraft("");
  }
  return (
    <div>
      <div className="mb-3 max-w-xs">
        <label className={labelClass}>Bullet style</label>
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
              placeholder="e.g. Mainframe Modernization"
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label="Move up"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label="Move down"
                disabled={i === items.length - 1}
                onClick={() => onMove(i, 1)}
              >
                ↓
              </IconButton>
              <IconButton label="Remove" danger onClick={() => onRemove(i)}>
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
          placeholder="Add an area of expertise and press Enter"
        />
        <button
          type="button"
          onClick={commitDraft}
          className="shrink-0 rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          + Add
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Rendered as a balanced two-column list on the ATS Corporate Style
        template, using the selected bullet style.
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
  return (
    <div>
      {items.length > 0 && (
        <div className="mb-1 flex items-center gap-2">
          <span className="flex-1 text-xs font-medium text-muted-foreground sm:max-w-[40%]">
            Category
          </span>
          <span className="flex-1 text-xs font-medium text-muted-foreground">Value</span>
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
              placeholder="e.g. Mainframe"
            />
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={item.value}
              onChange={(e) => onUpdate(i, { value: e.target.value })}
              placeholder="e.g. COBOL, PL/I, JCL"
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label="Move up"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label="Move down"
                disabled={i === items.length - 1}
                onClick={() => onMove(i, 1)}
              >
                ↓
              </IconButton>
              <IconButton label="Remove" danger onClick={() => onRemove(i)}>
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
          Add item
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
        Reorder, rename, and show/hide the sections of the resume document. This
        order and these names apply to the live preview and to the PDF, DOCX, and
        PPTX exports. Empty sections are hidden automatically. “Break after”
        forces the next section onto a new A4 page (ATS Corporate Style template,
        preview + PDF).
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
                      (custom)
                    </span>
                  )}
                  {hasCustomLabel && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground/70">
                      (renamed)
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
                    Show
                  </label>
                  <label className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={e.pageBreakAfter}
                      onChange={() => onTogglePageBreak(e.kind, id)}
                      className="h-3.5 w-3.5"
                    />
                    Break after
                  </label>
                  {renamable && (
                    <IconButton
                      label={`Rename “${e.label}” section`}
                      onClick={() =>
                        isEditing ? setEditingId(null) : startEdit(id, e.label)
                      }
                    >
                      ✎
                    </IconButton>
                  )}
                  <IconButton
                    label="Move section up"
                    disabled={i === 0}
                    onClick={() => onMove(e.kind, id, -1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label="Move section down"
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
                        ? `Default: ${sec.defaultTitle}`
                        : "Section name"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => commit(id)}
                    className="rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                  >
                    Save
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
                      Reset to default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-muted-foreground/70 hover:text-foreground/80"
                  >
                    Cancel
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
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground/70">
        Add your own sections (Projects, Awards, Publications, …). Each one joins
        the document order in the “Document Sections” card, so you can place it
        anywhere and it flows into the live preview and every export.
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
          + Add Custom Section
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
                (hidden)
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
            Show in Resume
          </label>
          <button
            type="button"
            onClick={() => onDelete(id)}
            className="rounded-md border border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:border-red-200 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400"
          >
            Delete Section
          </button>
        </div>
      </div>

      {!section.collapsed && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Section Title</label>
              <input
                className={inputClass}
                value={section.title}
                onChange={(e) => onUpdate(id, { title: e.target.value })}
                placeholder="e.g. Projects"
              />
            </div>
            <div>
              <label className={labelClass}>Layout Type</label>
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
              <label className={labelClass}>Bullet Style</label>
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
              <label className={labelClass}>Content</label>
              <textarea
                className={inputClass}
                rows={4}
                value={section.freeText}
                onChange={(e) => onUpdate(id, { freeText: e.target.value })}
                placeholder="Paragraph-style content for this section."
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
      {items.length > 0 && <label className={labelClass}>Items</label>}
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
              placeholder="Bullet text"
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label="Move up"
                disabled={i === 0}
                onClick={() => onMoveItem(section.id, i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label="Move down"
                disabled={i === items.length - 1}
                onClick={() => onMoveItem(section.id, i, 1)}
              >
                ↓
              </IconButton>
              <IconButton
                label="Remove"
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
          placeholder="Add an item and press Enter"
        />
        <button
          type="button"
          onClick={commit}
          className="shrink-0 rounded-md border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          Add item
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
  const items = section.items ?? [];
  return (
    <div>
      {items.length > 0 && <label className={labelClass}>Items</label>}
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
              placeholder="Category (e.g. Database)"
            />
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={item.value}
              onChange={(e) =>
                onUpdateItem(section.id, i, { value: e.target.value })
              }
              placeholder="Value (e.g. DB2, Oracle)"
            />
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label="Move up"
                disabled={i === 0}
                onClick={() => onMoveItem(section.id, i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label="Move down"
                disabled={i === items.length - 1}
                onClick={() => onMoveItem(section.id, i, 1)}
              >
                ↓
              </IconButton>
              <IconButton
                label="Remove"
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
          Add item
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
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
    >
      + Add
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

function ItemCard({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-muted/50 p-3">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 text-xs text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400"
      >
        Remove
      </button>
      {children}
    </div>
  );
}
