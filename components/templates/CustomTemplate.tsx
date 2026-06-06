import { Fragment } from "react";
import type {
  ResumeData,
  ResumeSectionId,
  ResumeSectionState,
  TemplateStyleSettings,
} from "@/lib/types";
import {
  orderedVisibleDocSections,
  resolveSectionLabels,
  resolveSkillCategories,
  resolveTemplateStyle,
} from "@/lib/constants";
import CustomSectionContent, { CategoryValueRows } from "./CustomSectionContent";

// Two-column accented layout: left rail for contact/skills, right for content.
// The left rail background uses the selected primary color. Section ordering is
// honored independently within each column — sidebar sections (skills, certs,
// languages) reorder among themselves, and main-column sections (summary,
// experience, projects, education) reorder among themselves — so the chosen
// order is respected without breaking the two-column structure.
export default function CustomTemplate({
  data,
  style,
  sectionState,
}: {
  data: ResumeData;
  style?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
}) {
  const s = resolveTemplateStyle(style);
  const { basics } = data;
  // Resolved section headings (customTitle || defaultTitle) keyed by section id.
  const labels = resolveSectionLabels(sectionState);

  const sidebarSections: Partial<Record<ResumeSectionId, React.ReactNode>> = {
    skills: (
      <div className="text-xs">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/70">
          {labels.skills}
        </h2>
        <CategoryValueRows
          items={resolveSkillCategories(data)}
          categoryColor="rgba(255,255,255,0.85)"
        />
      </div>
    ),
    certifications: (
      <div>
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/70">
          {labels.certifications}
        </h2>
        <ul className="space-y-1 text-xs">
          {data.certifications.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    ),
    languages: (
      <div>
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/70">
          {labels.languages}
        </h2>
        <ul className="space-y-1 text-xs">
          {data.languages.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    ),
  };

  const mainSections: Partial<Record<ResumeSectionId, React.ReactNode>> = {
    summary: (
      <Section title={labels.summary} style={s}>
        <p>{basics.summary}</p>
      </Section>
    ),
    experience: (
      <Section title={labels.experience} style={s}>
        {data.experience.map((exp, i) => (
          <div key={i} className="mb-3">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold text-gray-900">{exp.role}</p>
              <span className="text-xs text-gray-500">
                {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
              </span>
            </div>
            <p className="text-xs text-brand-700">
              {[exp.company, exp.location].filter(Boolean).join(" · ")}
            </p>
            {exp.highlights.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {exp.highlights.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>
    ),
    projects: (
      <Section title={labels.projects} style={s}>
        {data.projects.map((p, i) => (
          <div key={i} className="mb-2">
            <p className="font-semibold text-gray-900">{p.name}</p>
            {p.description && <p>{p.description}</p>}
          </div>
        ))}
      </Section>
    ),
    education: (
      <Section title={labels.education} style={s}>
        {data.education.map((ed, i) => (
          <div key={i} className="mb-2">
            <p className="font-semibold text-gray-900">{ed.school}</p>
            <p className="text-xs text-gray-600">
              {[ed.degree, ed.field].filter(Boolean).join(", ")}
              {(ed.startDate || ed.endDate) &&
                ` · ${[ed.startDate, ed.endDate].filter(Boolean).join(" – ")}`}
            </p>
          </div>
        ))}
      </Section>
    ),
  };

  // Sidebar holds the default sections that belong in the rail (skills, certs,
  // languages); everything else — the remaining default sections and ALL custom
  // sections — flows down the main column, each in its document-order position.
  const order = orderedVisibleDocSections(data, sectionState);
  const sidebarOrder = order.filter(
    (e) => e.kind === "default" && e.sectionId in sidebarSections
  );
  const mainOrder = order.filter(
    (e) => e.kind === "custom" || e.sectionId in mainSections
  );

  return (
    <div
      className="grid grid-cols-3 bg-white text-[13px] leading-relaxed text-gray-800"
      style={{ fontFamily: s.fontFamily }}
    >
      <aside
        className="col-span-1 space-y-6 p-6 text-white"
        style={{ backgroundColor: s.primaryColor }}
      >
        <div>
          <h1 className="text-2xl font-bold leading-tight text-white">
            {basics.name || "Your Name"}
          </h1>
          {basics.title && (
            <p className="mt-1 text-sm text-white/80">{basics.title}</p>
          )}
          <div className="mt-6 space-y-1 text-xs">
            {basics.email && <p>{basics.email}</p>}
            {basics.phone && <p>{basics.phone}</p>}
            {basics.location && <p>{basics.location}</p>}
            {basics.website && <p>{basics.website}</p>}
          </div>
        </div>

        {sidebarOrder.map((e) =>
          e.kind === "default" ? (
            <Fragment key={e.sectionId}>{sidebarSections[e.sectionId]}</Fragment>
          ) : null
        )}
      </aside>

      <div className="col-span-2 p-7">
        {mainOrder.map((e) =>
          e.kind === "custom" ? (
            <Section key={e.id} title={e.label} style={s}>
              <CustomSectionContent section={e.section} style={s} />
            </Section>
          ) : (
            <Fragment key={e.sectionId}>{mainSections[e.sectionId]}</Fragment>
          )
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  style,
  children,
}: {
  title: string;
  style: TemplateStyleSettings;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2
        className="mb-2 pb-1 text-xs font-bold uppercase tracking-widest"
        style={{
          color: style.primaryColor,
          borderBottom: `2px solid ${style.sectionLineColor}`,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
