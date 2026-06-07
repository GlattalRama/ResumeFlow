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
import RichText, { InlineRichText } from "../RichText";

export default function ModernTemplate({
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

  // Section bodies keyed by section id. orderedVisibleSections decides which
  // appear and in what order; ids this template doesn't render are simply
  // absent from the map and skipped.
  const sections: Partial<Record<ResumeSectionId, React.ReactNode>> = {
    summary: (
      <Section title={labels.summary} style={s}>
        <RichText value={basics.summary} />
      </Section>
    ),
    experience: (
      <Section title={labels.experience} style={s}>
        {data.experience.map((exp, i) => (
          <div key={i} className="mb-3">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold text-gray-900">
                {exp.role}
                {exp.company && (
                  <span className="font-normal text-gray-600"> · {exp.company}</span>
                )}
              </p>
              <span className="text-xs text-gray-500">
                {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
              </span>
            </div>
            {exp.location && (
              <p className="text-xs text-gray-500">{exp.location}</p>
            )}
            {exp.highlights.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {exp.highlights.map((h, j) => (
                  <li key={j}><InlineRichText value={h} /></li>
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
            <p className="font-semibold text-gray-900">
              {p.name}
              {p.link && (
                <span className="ml-2 text-xs font-normal text-brand-600">
                  {p.link}
                </span>
              )}
            </p>
            {p.description && <p>{p.description}</p>}
          </div>
        ))}
      </Section>
    ),
    education: (
      <Section title={labels.education} style={s}>
        {data.education.map((ed, i) => (
          <div key={i} className="mb-2 flex items-baseline justify-between">
            <div>
              <p className="font-semibold text-gray-900">{ed.school}</p>
              <p className="text-xs text-gray-600">
                {[ed.degree, ed.field].filter(Boolean).join(", ")}
              </p>
            </div>
            <span className="text-xs text-gray-500">
              {[ed.startDate, ed.endDate].filter(Boolean).join(" – ")}
            </span>
          </div>
        ))}
      </Section>
    ),
    skills: (
      <Section title={labels.skills} style={s}>
        <CategoryValueRows
          items={resolveSkillCategories(data)}
          categoryColor={s.primaryColor}
        />
      </Section>
    ),
    certifications: (
      <Section title={labels.certifications} style={s}>
        <ul className="list-disc space-y-0.5 pl-5">
          {data.certifications.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Section>
    ),
    languages: (
      <Section title={labels.languages} style={s}>
        <p>{data.languages.join(", ")}</p>
      </Section>
    ),
  };

  return (
    <div
      className="bg-white text-[13px] leading-relaxed text-gray-800"
      style={{ fontFamily: s.fontFamily }}
    >
      <header className="border-l-4 pl-4" style={{ borderColor: s.primaryColor }}>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: s.primaryColor }}
        >
          {basics.name || "Your Name"}
        </h1>
        {basics.title && (
          <p className="mt-1 text-lg font-medium" style={{ color: s.primaryColor }}>
            {basics.title}
          </p>
        )}
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          {[basics.email, basics.phone, basics.location, basics.website]
            .filter(Boolean)
            .map((v, i) => (
              <span key={i}>{v}</span>
            ))}
        </p>
      </header>

      {orderedVisibleDocSections(data, sectionState).map((entry) =>
        entry.kind === "custom" ? (
          <Section key={entry.id} title={entry.label} style={s}>
            <CustomSectionContent section={entry.section} style={s} />
          </Section>
        ) : sections[entry.sectionId] ? (
          <Fragment key={entry.sectionId}>
            {sections[entry.sectionId]}
          </Fragment>
        ) : null
      )}
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
    <section className="mt-5">
      <h2
        className="mb-2 text-xs font-bold uppercase tracking-widest"
        style={{ color: style.primaryColor }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
