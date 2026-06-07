import type {
  ResumeData,
  ResumeSectionId,
  ResumeSectionState,
  TemplateStyleSettings,
} from "@/lib/types";
import {
  getBulletSymbol,
  orderedVisibleDocSections,
  resolveSectionLabels,
  resolveSkillCategories,
  resolveTemplateStyle,
  splitIntoBalancedColumns,
} from "@/lib/constants";
import CustomSectionContent, { CategoryValueRows } from "./CustomSectionContent";
import RichText, { InlineRichText } from "../RichText";

// ATS Corporate Style: ATS-friendly, single column, plain headings, no columns. Fully honors
// the per-version style settings (font + colors) and the user-chosen document
// section order/visibility.
export default function AtsCorporateTemplate({
  data,
  style,
  sectionState,
  atsSafe = false,
}: {
  data: ResumeData;
  style?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
  // ATS-safe mode: single-column lists, no photo, plain text contact line and
  // a real bulleted Areas list — maximizes parse reliability for resume bots.
  atsSafe?: boolean;
}) {
  const s = resolveTemplateStyle(style);
  const { basics } = data;
  // Resolved section headings (customTitle || defaultTitle) keyed by section id.
  const labels = resolveSectionLabels(sectionState);
  // Older resume records may predate these fields; default to empty.
  const areasOfExpertise = data.areasOfExpertise ?? [];
  // Prefer the Drive-backed photo (served by a secure server route that holds
  // the OAuth token); fall back to an embedded Base64 photo in local dev mode.
  const profilePhoto = data.profilePhotoMeta?.driveFileId
    ? `/api/drive/photos/${data.profilePhotoMeta.driveFileId}`
    : data.profilePhoto ?? "";
  // "circle" uses a square frame so the photo is a true circle; "square"
  // (default) keeps the landscape rounded-rectangle look.
  const photoShapeClass =
    (data.profilePhotoShape ?? "square") === "circle"
      ? "h-28 w-28 rounded-full"
      : "h-28 w-32 rounded-md";

  const sections: Partial<Record<ResumeSectionId, React.ReactNode>> = {
    summary: (
      <Section title={labels.summary} style={s}>
        <RichText value={basics.summary} />
      </Section>
    ),
    areas: (
      <Section title={labels.areas} style={s}>
        {atsSafe ? (
          // ATS-safe: a single-column real <ul> list (no columns, no glyph
          // spans) so parsers read every item in order.
          <ul className="rf-spaced list-disc pl-5">
            {areasOfExpertise.map((area, i) => (
              <li key={i}>{area}</li>
            ))}
          </ul>
        ) : (
          /* Balanced two-column layout: the list is split so the left column
             fills first (10 -> 5/5, 9 -> 5/4). Custom marker honors the
             selected style. */
          <AreasTwoColumns
            items={areasOfExpertise}
            bulletStyle={data.areasOfExpertiseBulletStyle}
            markerColor={s.primaryColor}
          />
        )}
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
    experience: (
      <Section title={labels.experience} style={s}>
        {data.experience.map((exp, i) => (
          <div key={i} className="mb-3">
            <p className="font-bold">
              {exp.role}
              {exp.company ? `, ${exp.company}` : ""}
            </p>
            <p className="text-[0.92em]" style={{ color: s.mutedColor }}>
              {[exp.location, [exp.startDate, exp.endDate]
                .filter(Boolean)
                .join(" - ")]
                .filter(Boolean)
                .join(" | ")}
            </p>
            {exp.highlights.length > 0 && (
              <ul className="rf-spaced mt-1 list-disc pl-5">
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
            <p className="font-bold">{p.name}</p>
            {p.description && <p>{p.description}</p>}
            {p.link && (
              <p className="text-[0.92em]" style={{ color: s.mutedColor }}>
                {p.link}
              </p>
            )}
          </div>
        ))}
      </Section>
    ),
    education: (
      <Section title={labels.education} style={s}>
        {data.education.map((ed, i) => (
          <div key={i} className="mb-1">
            <p className="font-bold">{ed.school}</p>
            <p className="text-[0.92em]" style={{ color: s.mutedColor }}>
              {[
                [ed.degree, ed.field].filter(Boolean).join(", "),
                [ed.startDate, ed.endDate].filter(Boolean).join(" - "),
              ]
                .filter(Boolean)
                .join(" | ")}
            </p>
          </div>
        ))}
      </Section>
    ),
    certifications: (
      <Section title={labels.certifications} style={s}>
        <ul className="rf-spaced list-disc pl-5">
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
      className="bg-white"
      style={
        {
          fontFamily: s.fontFamily,
          fontSize: `${s.fontSize}px`,
          color: s.bodyColor,
          lineHeight: s.lineSpacing.text,
          "--rf-section-gap": `${s.lineSpacing.section}rem`,
          "--rf-bullet-gap": `${s.lineSpacing.bullet}rem`,
        } as React.CSSProperties
      }
    >
      {atsSafe ? (
        // ATS-safe header: no photo, plain text name/title and a single-line
        // contact string — the simplest possible block for a parser to read.
        <header>
          <h1
            className="font-bold leading-tight"
            style={{ color: s.bodyColor, fontSize: `${s.fontScale.name}em` }}
          >
            {basics.name || "Your Name"}
          </h1>
          {basics.title && (
            <p
              className="mt-1.5 text-[1.08em] font-medium"
              style={{ color: s.primaryColor }}
            >
              {basics.title}
            </p>
          )}
          {(basics.email || basics.phone || basics.website) && (
            <p className="mt-1.5 text-[0.92em]" style={{ color: s.mutedColor }}>
              {[basics.email, basics.phone, basics.website]
                .filter(Boolean)
                .join("  |  ")}
            </p>
          )}
        </header>
      ) : (
        /* Cognizant-style header: photo on the left, name + role in the middle,
           and a right-aligned contact column with icons. */
        <header className="flex items-center gap-6">
          {profilePhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profilePhoto}
              alt={basics.name || "Profile photo"}
              className={`shrink-0 border border-gray-200 object-cover ${photoShapeClass}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="font-bold leading-tight"
              style={{ color: s.bodyColor, fontSize: `${s.fontScale.name}em` }}
            >
              {basics.name || "Your Name"}
            </h1>
            {basics.title && (
              <p
                className="mt-1.5 text-[1.08em] font-medium"
                style={{ color: s.primaryColor }}
              >
                {basics.title}
              </p>
            )}
          </div>
          {(basics.email || basics.phone || basics.website) && (
            <div className="shrink-0 space-y-2 text-[0.92em]">
              {basics.email && (
                <ContactRow icon={<MailIcon />} color={s.primaryColor}>
                  {basics.email}
                </ContactRow>
              )}
              {basics.phone && (
                <ContactRow icon={<PhoneIcon />} color={s.primaryColor}>
                  {basics.phone}
                </ContactRow>
              )}
              {basics.website && (
                <ContactRow icon={<LinkIcon />} color={s.primaryColor}>
                  {basics.website}
                </ContactRow>
              )}
            </div>
          )}
        </header>
      )}

      {orderedVisibleDocSections(data, sectionState).map((entry) => {
        const content =
          entry.kind === "custom" ? (
            <Section title={entry.label} style={s}>
              <CustomSectionContent
                section={entry.section}
                style={s}
                atsSafe={atsSafe}
              />
            </Section>
          ) : (
            sections[entry.sectionId] ?? null
          );
        if (!content) return null;
        const key = entry.kind === "custom" ? `c:${entry.id}` : entry.sectionId;
        return (
          <div
            key={key}
            style={entry.pageBreakAfter ? { breakAfter: "page" } : undefined}
          >
            {content}
            {/* Screen-only spacer; A4Preview grows it to fill the rest of the
                page so the next section starts on a new page. Print uses the
                breakAfter rule above instead. */}
            {entry.pageBreakAfter && (
              <div data-pb-spacer aria-hidden className="print:hidden" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Renders Areas of Expertise as two balanced columns (left column fills first)
// with the selected bullet marker. Used by the ATS Corporate Style template and any other
// template that shows Areas of Expertise.
function AreasTwoColumns({
  items,
  bulletStyle,
  markerColor,
}: {
  items: string[];
  bulletStyle: ResumeData["areasOfExpertiseBulletStyle"];
  markerColor: string;
}) {
  const [left, right] = splitIntoBalancedColumns(items);
  const marker = getBulletSymbol(bulletStyle);
  const column = (col: string[]) => (
    <ul className="rf-spaced flex-1" style={{ listStyle: "none" }}>
      {col.map((area, i) => (
        <li key={i} className="flex gap-1.5">
          {marker && (
            <span aria-hidden style={{ color: markerColor }}>
              {marker}
            </span>
          )}
          <span>{area}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex gap-x-8">
      {column(left)}
      {right.length > 0 && column(right)}
    </div>
  );
}

// A single contact line in the header: a small colored icon followed by text,
// vertically centered so multiple rows line up evenly.
function ContactRow({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0" style={{ color }} aria-hidden>
        {icon}
      </span>
      <span className="break-all">{children}</span>
    </div>
  );
}

// Inline SVG icons keep the header self-contained (no icon-library dependency)
// and let them inherit the surrounding color via currentColor.
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79a15.53 15.53 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.4 11.4 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.57 1 1 0 0 1-.24 1.02l-2.21 2.2Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
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
    <section style={{ marginTop: "var(--rf-section-gap, 1rem)" }}>
      <h2
        className="pb-0.5 font-bold uppercase"
        style={{
          color: style.primaryColor,
          borderBottom: `1px solid ${style.sectionLineColor}`,
          fontSize: `${style.fontScale.heading}em`,
        }}
      >
        {title}
      </h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}
