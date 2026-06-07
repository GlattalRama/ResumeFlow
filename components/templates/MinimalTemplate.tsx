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

export default function MinimalTemplate({
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

  const sections: Partial<Record<ResumeSectionId, React.ReactNode>> = {
    // Summary keeps its understated, heading-less treatment, so it has no
    // renamable label in this template.
    summary: (
      <div className="mt-6 max-w-prose text-gray-600">
        <RichText value={basics.summary} />
      </div>
    ),
    experience: (
      <Section title={labels.experience} style={s}>
        {data.experience.map((exp, i) => (
          <div key={i} className="mb-4">
            <p className="text-gray-900">
              {exp.role}
              {exp.company && (
                <span className="text-gray-400"> — {exp.company}</span>
              )}
            </p>
            <p className="text-xs text-gray-400">
              {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
              {exp.location ? `  ·  ${exp.location}` : ""}
            </p>
            {exp.highlights.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {exp.highlights.map((h, j) => (
                  <li key={j} className="text-gray-600">
                    <InlineRichText value={h} />
                  </li>
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
            <p className="text-gray-900">{p.name}</p>
            {p.description && <p className="text-gray-600">{p.description}</p>}
          </div>
        ))}
      </Section>
    ),
    education: (
      <Section title={labels.education} style={s}>
        {data.education.map((ed, i) => (
          <p key={i} className="mb-1 text-gray-700">
            {ed.school}
            {(ed.degree || ed.field) && (
              <span className="text-gray-400">
                {" "}
                — {[ed.degree, ed.field].filter(Boolean).join(", ")}
              </span>
            )}
          </p>
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
        <p className="text-gray-600">{data.certifications.join("   ·   ")}</p>
      </Section>
    ),
    languages: (
      <Section title={labels.languages} style={s}>
        <p className="text-gray-600">{data.languages.join("   ·   ")}</p>
      </Section>
    ),
  };

  return (
    <div
      className="bg-white text-[13px] font-light leading-relaxed text-gray-700"
      style={{ fontFamily: s.fontFamily }}
    >
      <header>
        <h1
          className="text-2xl font-normal tracking-tight"
          style={{ color: s.primaryColor }}
        >
          {basics.name || "Your Name"}
        </h1>
        {basics.title && (
          <p className="mt-0.5 text-sm text-gray-500">{basics.title}</p>
        )}
        <p className="mt-3 text-xs text-gray-400">
          {[basics.email, basics.phone, basics.location, basics.website]
            .filter(Boolean)
            .join("   /   ")}
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
    <section className="mt-7">
      <h2
        className="mb-2 text-[10px] uppercase tracking-[0.25em]"
        style={{ color: style.primaryColor }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
