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

export default function ClassicTemplate({
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
              <p className="font-bold">{exp.company || exp.role}</p>
              <span className="text-xs italic">
                {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
              </span>
            </div>
            <p className="italic">
              {[exp.role, exp.location].filter(Boolean).join(", ")}
            </p>
            {exp.highlights.length > 0 && (
              <ul className="mt-1 list-[square] space-y-0.5 pl-5">
                {exp.highlights.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>
    ),
    education: (
      <Section title={labels.education} style={s}>
        {data.education.map((ed, i) => (
          <div key={i} className="mb-2 flex items-baseline justify-between">
            <p>
              <span className="font-bold">{ed.school}</span>
              {(ed.degree || ed.field) && (
                <span> — {[ed.degree, ed.field].filter(Boolean).join(", ")}</span>
              )}
            </p>
            <span className="text-xs italic">
              {[ed.startDate, ed.endDate].filter(Boolean).join(" – ")}
            </span>
          </div>
        ))}
      </Section>
    ),
    projects: (
      <Section title={labels.projects} style={s}>
        {data.projects.map((p, i) => (
          <div key={i} className="mb-2">
            <p className="font-bold">{p.name}</p>
            {p.description && <p>{p.description}</p>}
            {p.link && <p className="text-xs italic">{p.link}</p>}
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
        <p>{data.certifications.join(" · ")}</p>
      </Section>
    ),
    languages: (
      <Section title={labels.languages} style={s}>
        <p>{data.languages.join(" · ")}</p>
      </Section>
    ),
  };

  return (
    <div
      className="bg-white text-[13px] leading-relaxed text-gray-900"
      style={{ fontFamily: s.fontFamily }}
    >
      <header
        className="border-b-2 pb-3 text-center"
        style={{ borderColor: s.sectionLineColor }}
      >
        <h1
          className="text-3xl font-bold uppercase tracking-wide"
          style={{ color: s.primaryColor }}
        >
          {basics.name || "Your Name"}
        </h1>
        {basics.title && <p className="mt-1 italic">{basics.title}</p>}
        <p className="mt-2 text-xs text-gray-600">
          {[basics.email, basics.phone, basics.location, basics.website]
            .filter(Boolean)
            .join("  •  ")}
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
        className="mb-1 text-sm font-bold uppercase tracking-wide"
        style={{
          color: style.primaryColor,
          borderBottom: `1px solid ${style.sectionLineColor}`,
        }}
      >
        {title}
      </h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}
