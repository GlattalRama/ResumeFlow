"use client";

import { useMemo, useState } from "react";
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
  TemplateStyleSettings,
} from "@/lib/types";
import {
  BULLET_STYLE_OPTIONS,
  CUSTOM_LAYOUT_OPTIONS,
  DEFAULT_TEMPLATE_ID,
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
import { htmlToLines, linesToHtml } from "@/lib/richText";
import { buttonClass } from "./ui";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "block text-xs font-medium text-gray-600 mb-1";

interface Props {
  mode: "create" | "edit";
  initial?: ResumeVersion;
}

export default function ResumeBuilder({ mode, initial }: Props) {
  const router = useRouter();

  const [versionName, setVersionName] = useState(initial?.versionName ?? "");
  const [targetRole, setTargetRole] = useState(initial?.targetRole ?? "");
  const [template, setTemplate] = useState<TemplateId>(
    initial ? normalizeTemplateId(initial.selectedTemplate) : DEFAULT_TEMPLATE_ID
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
  // Live-preview-only: render the ATS-safe layout (single column, no photo).
  const [atsView, setAtsView] = useState(false);

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

  // Content for each form card, keyed by cardId. Cards are rendered in the
  // user-chosen order; the CollapsibleCard wrapper supplies the header, the
  // collapse toggle, and the drag handle.
  const cardContent: Record<
    string,
    { count?: number; headerRight?: React.ReactNode; body: React.ReactNode }
  > = {
    template: {
      body: <TemplateSelector value={template} onChange={setTemplate} />,
    },
    style: {
      headerRight: (
        <button
          type="button"
          onClick={() => setTemplateStyle(defaultTemplateStyle())}
          className="text-xs text-gray-400 hover:text-brand-600"
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
                  <span className="mb-1 block text-xs capitalize text-gray-500">
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
                  <span className="mb-1 block text-xs text-gray-500">{label}</span>
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
          <p className="mt-2 text-xs text-gray-400">
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
          onMove={moveDocSection}
          onToggleVisible={toggleDocVisible}
          onTogglePageBreak={togglePageBreak}
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
                  className={`h-16 w-16 border border-gray-200 object-cover ${
                    photoShape === "circle" ? "rounded-full" : "rounded-md"
                  }`}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400">
                  No photo
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
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
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            {/* Shape choice (ATS Corporate Style template). Shown once a photo is present. */}
            {photoSrc && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Shape:</span>
                <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                  {(["square", "circle"] as const).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() =>
                        setData((d) => ({ ...d, profilePhotoShape: shape }))
                      }
                      className={`px-2.5 py-1 text-xs font-medium capitalize ${
                        photoShape === shape
                          ? "bg-gray-800 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
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

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Left: ordered, collapsible, draggable form cards */}
      <div className="space-y-4 lg:col-span-2">
        <p className="text-xs text-gray-400">
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
          return (
            <CollapsibleCard
              key={card.cardId}
              card={card}
              count={content.count}
              headerRight={content.headerRight}
              isFirst={i === 0}
              isLast={i === orderedCards.length - 1}
              onToggle={() => toggleCollapse(card.cardId)}
              onMoveUp={() => moveCard(card.cardId, -1)}
              onMoveDown={() => moveCard(card.cardId, 1)}
              displayTitle={sec ? sectionLabel(sec) : undefined}
              defaultTitle={sec?.defaultTitle}
              hasCustomLabel={Boolean(sec?.customTitle)}
              onRename={
                sec ? (value) => renameSection(card.cardId, value) : undefined
              }
              onResetLabel={
                sec ? () => resetSectionLabel(card.cardId) : undefined
              }
            >
              {content.body}
            </CollapsibleCard>
          );
        })}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className={buttonClass("primary")}>
            {saving ? "Saving…" : mode === "create" ? "Create resume" : "Save changes"}
          </button>
          <button
            onClick={() => router.back()}
            className={buttonClass("secondary")}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Right: live preview */}
      <div className="lg:col-span-3 lg:sticky lg:top-20 lg:self-start">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-700">Live preview</p>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={atsView}
              onChange={(e) => setAtsView(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            ATS-safe view
          </label>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm">
          <div className="max-h-[80vh] overflow-y-auto p-3">
            <A4Preview margins={templateStyle.pageMargins}>
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
  );
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
  defaultTitle,
  hasCustomLabel,
  onRename,
  onResetLabel,
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
  // (customTitle || defaultTitle), the canonical default, whether a custom label
  // is set, and rename/reset callbacks. Absent for configuration cards.
  displayTitle?: string;
  defaultTitle?: string;
  hasCustomLabel?: boolean;
  onRename?: (value: string) => void;
  onResetLabel?: () => void;
  children: React.ReactNode;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState("");
  // Section cards show their (possibly custom) label; other cards keep the
  // canonical card title.
  const title = displayTitle ?? card.title;

  function startEdit() {
    setDraft(displayTitle ?? "");
    setEditingLabel(true);
  }
  function commit() {
    onRename?.(draft);
    setEditingLabel(false);
  }
  function reset() {
    onResetLabel?.();
    setEditingLabel(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!card.collapsed}
        >
          <span
            className="text-gray-400 transition-transform"
            aria-hidden
            style={{ transform: card.collapsed ? "rotate(-90deg)" : "none" }}
          >
            ▾
          </span>
          <span className="truncate text-sm font-semibold text-gray-700">
            {title}
            {hasCustomLabel && (
              <span className="ml-1 text-xs font-normal text-gray-400">
                (renamed)
              </span>
            )}
            {typeof count === "number" && (
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({count})
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {headerRight}
          {onRename && (
            <IconButton label="Rename section" onClick={startEdit}>
              ✎
            </IconButton>
          )}
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
      {/* Inline label editor — available even while the card is collapsed. */}
      {editingLabel && onRename && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2">
          <input
            autoFocus
            className={`${inputClass} flex-1`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setEditingLabel(false);
              }
            }}
            placeholder={defaultTitle ? `Default: ${defaultTitle}` : "Section label"}
          />
          <button
            type="button"
            onClick={commit}
            className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Save
          </button>
          {hasCustomLabel && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-gray-400 hover:text-brand-600"
            >
              Reset to default
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditingLabel(false)}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
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
          className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          + Add
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">
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
          <span className="flex-1 text-xs font-medium text-gray-500 sm:max-w-[40%]">
            Category
          </span>
          <span className="flex-1 text-xs font-medium text-gray-500">Value</span>
          <span className="w-[104px] shrink-0" />
        </div>
      )}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={`${inputClass} flex-1 sm:max-w-[40%]`}
              value={item.category}
              onChange={(e) => onUpdate(i, { category: e.target.value })}
              placeholder="e.g. Mainframe"
            />
            <input
              className={`${inputClass} flex-1`}
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
          className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
  onMove,
  onToggleVisible,
  onTogglePageBreak,
}: {
  entries: DocSectionEntry[];
  onMove: (kind: DocSectionEntry["kind"], id: string, dir: -1 | 1) => void;
  onToggleVisible: (kind: DocSectionEntry["kind"], id: string) => void;
  onTogglePageBreak: (kind: DocSectionEntry["kind"], id: string) => void;
}) {
  const entryId = (e: DocSectionEntry) =>
    e.kind === "default" ? e.sectionId : e.id;
  return (
    <div>
      <p className="mb-3 text-xs text-gray-400">
        Reorder and show/hide the sections of the resume document. This order
        applies to the live preview and to the PDF, DOCX, and PPTX exports. Empty
        sections are hidden automatically. “Break after” forces the next section
        onto a new A4 page (ATS Corporate Style template, preview + PDF).
      </p>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div
            key={`${e.kind}:${entryId(e)}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <span
              className={`truncate text-sm font-medium ${
                e.visible ? "text-gray-700" : "text-gray-400 line-through"
              }`}
            >
              {e.label}
              {e.kind === "custom" && (
                <span className="ml-1 text-xs font-normal text-gray-400">
                  (custom)
                </span>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <label className="mr-1 flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={e.visible}
                  onChange={() => onToggleVisible(e.kind, entryId(e))}
                  className="h-3.5 w-3.5"
                />
                Show
              </label>
              <label className="mr-1 flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={e.pageBreakAfter}
                  onChange={() => onTogglePageBreak(e.kind, entryId(e))}
                  className="h-3.5 w-3.5"
                />
                Break after
              </label>
              <IconButton
                label="Move section up"
                disabled={i === 0}
                onClick={() => onMove(e.kind, entryId(e), -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label="Move section down"
                disabled={i === entries.length - 1}
                onClick={() => onMove(e.kind, entryId(e), 1)}
              >
                ↓
              </IconButton>
            </div>
          </div>
        ))}
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
      <p className="mb-3 text-xs text-gray-400">
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
          className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => onUpdate(id, { collapsed: !section.collapsed })}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!section.collapsed}
        >
          <span
            className="text-gray-400"
            aria-hidden
            style={{ transform: section.collapsed ? "rotate(-90deg)" : "none" }}
          >
            ▾
          </span>
          <span className="truncate text-sm font-semibold text-gray-700">
            {customSectionLabel(section)}
            {!section.visible && (
              <span className="ml-1 text-xs font-normal text-gray-400">
                (hidden)
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500">
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
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-600"
          >
            Delete Section
          </button>
        </div>
      </div>

      {!section.collapsed && (
        <div className="space-y-3 border-t border-gray-200 px-3 py-3">
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
            <span className="w-5 shrink-0 text-right text-xs text-gray-400">
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
          className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
            <span className="w-5 shrink-0 text-right text-xs text-gray-400">
              {i + 1}.
            </span>
            <input
              className={`${inputClass} sm:max-w-[40%]`}
              value={item.category}
              onChange={(e) =>
                onUpdateItem(section.id, i, { category: e.target.value })
              }
              placeholder="Category (e.g. Database)"
            />
            <input
              className={inputClass}
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
          className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
      className={`flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "hover:border-red-200 hover:text-red-600" : ""
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
      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
          className="h-9 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
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
    <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-3">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 text-xs text-gray-400 hover:text-red-600"
      >
        Remove
      </button>
      {children}
    </div>
  );
}
