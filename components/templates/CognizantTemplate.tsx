import type {
  CustomSectionItem,
  ResumeData,
  ResumeSectionId,
  ResumeSectionState,
  TemplateStyleSettings,
} from "@/lib/types";
import {
  customSectionHasContent,
  getBulletSymbol,
  resolveSectionLabels,
  resolveSectionState,
  resolveSkillCategories,
  resolveTemplateStyle,
  sectionHasContent,
  splitIntoBalancedColumns,
} from "@/lib/constants";
import RichText, { InlineRichText } from "../RichText";

// Cognizant Corporate template — a branded, fixed two-page layout that matches
// the corporate resume format: a logo header with photo + contact column, blue
// section headings with a trailing rule, a two-column "Areas of expertise /
// Industries" band, full-width Work experience and Education, a "Language /
// Technical Skills" band, and a dedicated second page for "Selected relevant
// project experience".
//
// Unlike the generic templates this one uses a fixed layout (not the reorderable
// section flow), but it still honors per-section visibility and the user's
// custom section titles, and binds to the same ResumeData shape. "Industries" is
// sourced from a custom section whose title contains "industr" (e.g. add a
// "Industries" custom section in the builder); when absent that column is hidden.
export default function CognizantTemplate({
  data,
  style,
  sectionState,
  atsSafe = false,
}: {
  data: ResumeData;
  style?: TemplateStyleSettings;
  sectionState?: ResumeSectionState[] | null;
  atsSafe?: boolean;
}) {
  const s = resolveTemplateStyle(style);
  const { basics } = data;
  const labels = resolveSectionLabels(sectionState);

  // Per-section visibility (default visible) AND non-empty.
  const states = resolveSectionState(sectionState);
  const visible = new Map(states.map((st) => [st.sectionId, st.visible]));
  const show = (id: ResumeSectionId) =>
    (visible.get(id) ?? true) && sectionHasContent(data, id);

  // Industries: source from a visible, non-empty custom section titled like
  // "Industries". Falls back to none, in which case Areas spans the row.
  const industries = (data.customSections ?? []).find(
    (c) => /industr/i.test(c.title ?? "") && c.visible && customSectionHasContent(c)
  );
  const industryItems = industries
    ? (industries.items ?? []).map((it) => it.value).filter(Boolean)
    : [];

  const areas = (data.areasOfExpertise ?? []).filter(Boolean);
  const showAreas = show("areas") && areas.length > 0;
  const showIndustries = industryItems.length > 0;

  const languages = (data.languages ?? []).filter(Boolean);
  const showLanguages = show("languages") && languages.length > 0;
  const skills = resolveSkillCategories(data).filter(
    (it) => it.category?.trim() || it.value?.trim()
  );
  const showSkills = show("skills") && skills.length > 0;

  // Profile photo: prefer the Drive-backed photo; fall back to embedded Base64.
  const profilePhoto = data.profilePhotoMeta?.driveFileId
    ? `/api/drive/photos/${data.profilePhotoMeta.driveFileId}`
    : data.profilePhoto ?? "";

  const areasMarker = getBulletSymbol(data.areasOfExpertiseBulletStyle);

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
      {/* ---- Header: photo · name/title · contact column · logo ---- */}
      {!atsSafe && (
        <div className="mb-2 flex justify-end">
          <CognizantLogo color={s.primaryColor} />
        </div>
      )}
      <header className="flex items-start gap-6">
        {!atsSafe &&
          (profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profilePhoto}
              alt={basics.name || "Profile photo"}
              className="h-28 w-28 shrink-0 rounded-full border border-gray-200 object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="h-28 w-28 shrink-0 rounded-full bg-gray-200"
            />
          ))}
        <div className="min-w-0 flex-1">
          <h1
            className="font-bold leading-tight"
            style={{ color: s.bodyColor, fontSize: `${s.fontScale.name}em` }}
          >
            {basics.name || "Name surname"}
          </h1>
          {basics.title && (
            <p className="mt-1 text-[1.02em]" style={{ color: s.mutedColor }}>
              {basics.title}
            </p>
          )}
        </div>
        {(basics.email || basics.phone || basics.website) && (
          <div className="shrink-0 space-y-1.5 text-[0.9em]">
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
              <ContactRow icon={<LinkedInIcon />} color={s.primaryColor}>
                {basics.website}
              </ContactRow>
            )}
          </div>
        )}
      </header>

      {/* ---- Summary ---- */}
      {show("summary") && (
        <section>
          <Heading style={s}>{labels.summary}</Heading>
          <RichText value={basics.summary} />
        </section>
      )}

      {/* ---- Areas of expertise / Industries band ---- */}
      {(showAreas || showIndustries) && (
        <div className={atsSafe ? "" : "grid grid-cols-2 gap-x-10"}>
          {showAreas && (
            <section>
              <Heading style={s}>{labels.areas}</Heading>
              <BulletColumns
                items={areas}
                marker={areasMarker}
                markerColor={s.primaryColor}
                single={atsSafe}
              />
            </section>
          )}
          {showIndustries && (
            <section>
              <Heading style={s}>
                {industries?.title?.trim() || "Industries"}
              </Heading>
              <BulletColumns
                items={industryItems}
                marker={getBulletSymbol(industries?.bulletStyle)}
                markerColor={s.primaryColor}
                single={atsSafe}
              />
            </section>
          )}
        </div>
      )}

      {/* ---- Work experience ---- */}
      {show("experience") && (
        <section>
          <Heading style={s}>{labels.experience}</Heading>
          {data.experience.map((exp, i) => (
            <div
              key={i}
              className={
                atsSafe ? "mb-3" : "mb-3 grid grid-cols-[150px_1fr] gap-x-4"
              }
            >
              <div>
                {exp.company && (
                  <p className="font-bold" style={{ color: s.bodyColor }}>
                    {exp.company}
                  </p>
                )}
                {(exp.startDate || exp.endDate || exp.location) && (
                  <p className="text-[0.85em]" style={{ color: s.mutedColor }}>
                    {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                    {exp.location ? ` · ${exp.location}` : ""}
                  </p>
                )}
              </div>
              <div>
                {exp.role && <p className="font-bold">{exp.role}</p>}
                {/* Highlights as paragraphs (this template's prose style). */}
                {exp.highlights.filter(Boolean).map((h, j) => (
                  <p key={j} className="mt-0.5">
                    <InlineRichText value={h} />
                  </p>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ---- Education ---- */}
      {show("education") && (
        <section>
          <Heading style={s}>{labels.education}</Heading>
          {data.education.map((ed, i) => {
            const course = [ed.degree, ed.field].filter(Boolean).join(", ");
            const dates = [ed.startDate, ed.endDate].filter(Boolean).join(" – ");
            return (
              <div
                key={i}
                className={
                  atsSafe ? "mb-2" : "mb-2 grid grid-cols-[1fr_1fr] gap-x-6"
                }
              >
                <div>
                  <p className="font-bold" style={{ color: s.primaryColor }}>
                    {[course, ed.school].filter(Boolean).join(", ") || "—"}
                  </p>
                  {dates && (
                    <p className="text-[0.85em]" style={{ color: s.mutedColor }}>
                      {dates}
                    </p>
                  )}
                </div>
                <div>
                  {course && ed.school && (
                    <p style={{ color: s.bodyColor }}>{course}</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ---- Language / Technical Skills band ---- */}
      {(showLanguages || showSkills) && (
        <div className={atsSafe ? "" : "grid grid-cols-2 gap-x-10"}>
          {showLanguages && (
            <section>
              <Heading style={s}>{labels.languages}</Heading>
              <BulletColumns items={languages} marker="" single={atsSafe} />
            </section>
          )}
          {showSkills && (
            <section>
              <Heading style={s}>{labels.skills}</Heading>
              <SkillColumns
                items={skills}
                categoryColor={s.primaryColor}
                single={atsSafe}
              />
            </section>
          )}
        </div>
      )}

      <PageFooter style={s} page={1} total={show("projects") ? 2 : 1} />

      {/* ---- Page 2: Selected relevant project experience ---- */}
      {show("projects") && (
        <>
          {/* Screen-only spacer grows to fill the page so projects start on a
              fresh page; print uses the breakBefore rule below. */}
          <div data-pb-spacer aria-hidden className="print:hidden" />
          <section style={{ breakBefore: "page" }}>
            <Heading style={s} large>
              {labels.projects === "Projects"
                ? "Selected relevant project experience"
                : labels.projects}
            </Heading>
            {data.projects.map((p, i) => (
              <div
                key={i}
                className={
                  atsSafe ? "mb-3" : "mb-3 grid grid-cols-[180px_1fr] gap-x-4"
                }
              >
                <div>
                  {p.link && (
                    <p
                      className="break-all text-[0.85em]"
                      style={{ color: s.mutedColor }}
                    >
                      {p.link}
                    </p>
                  )}
                </div>
                <div>
                  {p.name && (
                    <p className="font-bold" style={{ color: s.primaryColor }}>
                      {p.name}
                    </p>
                  )}
                  {p.description && (
                    <p className="mt-0.5">
                      <InlineRichText value={p.description} />
                    </p>
                  )}
                </div>
              </div>
            ))}
            <PageFooter style={s} page={2} total={2} />
          </section>
        </>
      )}
    </div>
  );
}

// ---- Local presentational helpers ----

// A blue section heading followed by a thin rule that fills the remaining width,
// matching the Cognizant corporate look.
function Heading({
  children,
  style,
  large = false,
}: {
  children: React.ReactNode;
  style: TemplateStyleSettings;
  large?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3"
      style={{ marginTop: "var(--rf-section-gap, 1rem)", marginBottom: "0.4rem" }}
    >
      <h2
        className="whitespace-nowrap font-bold"
        style={{
          color: style.primaryColor,
          fontSize: `${style.fontScale.heading * (large ? 1.6 : 1.35)}em`,
        }}
      >
        {children}
      </h2>
      <span className="h-px flex-1" style={{ backgroundColor: "#c4c4c4" }} />
    </div>
  );
}

// A bulleted list rendered as two balanced columns (left fills first), or a
// single column when `single` (ATS-safe). `marker` "" renders no bullet glyph.
function BulletColumns({
  items,
  marker,
  markerColor,
  single = false,
}: {
  items: string[];
  marker: string;
  markerColor?: string;
  single?: boolean;
}) {
  const list = (col: string[]) => (
    <ul className="rf-spaced flex-1" style={{ listStyle: "none" }}>
      {col.map((item, i) => (
        <li key={i} className="flex gap-1.5">
          {marker && (
            <span aria-hidden style={{ color: markerColor }}>
              {marker}
            </span>
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
  if (single) return list(items);
  const [left, right] = splitIntoBalancedColumns(items);
  return (
    <div className="flex gap-x-8">
      {list(left)}
      {right.length > 0 && list(right)}
    </div>
  );
}

// Technical Skills as two balanced columns of "Category: value" (or just value)
// rows; single column when ATS-safe.
function SkillColumns({
  items,
  categoryColor,
  single = false,
}: {
  items: CustomSectionItem[];
  categoryColor?: string;
  single?: boolean;
}) {
  const list = (col: CustomSectionItem[]) => (
    <ul className="rf-spaced flex-1" style={{ listStyle: "none" }}>
      {col.map((it, i) => (
        <li key={i}>
          {it.category?.trim() && (
            <span className="font-semibold" style={{ color: categoryColor }}>
              {it.category}
              {it.value?.trim() ? ": " : ""}
            </span>
          )}
          {it.value}
        </li>
      ))}
    </ul>
  );
  if (single) return list(items);
  const [left, right] = splitIntoBalancedColumns(items);
  return (
    <div className="flex gap-x-8">
      {list(left)}
      {right.length > 0 && list(right)}
    </div>
  );
}

// Footer line shown at the end of each page block. Note: in flowed HTML this
// follows the content rather than pinning to the physical page bottom.
function PageFooter({
  style,
  page,
  total,
}: {
  style: TemplateStyleSettings;
  page: number;
  total: number;
}) {
  return (
    <div
      className="mt-6 flex items-center justify-between border-t pt-1 text-[0.78em]"
      style={{ borderColor: "#e5e7eb", color: style.mutedColor }}
    >
      <span>© 2025 – 2027 Cognizant. All rights reserved.</span>
      <span>
        {page}/{total}
      </span>
    </div>
  );
}

// A single contact line: a small colored icon followed by text.
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

// Cognizant wordmark with a hexagon mark. Self-contained (no asset/import) and
// tinted with the template's primary color so it tracks color customization.
function CognizantLogo({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
        <path d="M12 1.7l9 5.2v10.4l-9 5.2-9-5.2V6.9l9-5.2z" opacity="0.92" />
      </svg>
      <span
        className="font-semibold tracking-tight"
        style={{ color, fontSize: "1.15em" }}
      >
        Cognizant
        <sup style={{ fontSize: "0.5em" }}>™</sup>
      </span>
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79a15.53 15.53 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.4 11.4 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.57 1 1 0 0 1-.24 1.02l-2.21 2.2Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
