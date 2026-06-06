import type {
  CustomSection,
  CustomSectionItem,
  TemplateStyleSettings,
} from "@/lib/types";
import { getBulletSymbol, splitIntoBalancedColumns } from "@/lib/constants";

// Renders the body of a user-defined custom section in HTML, shared by every
// template so the four layouts (freeText, bullets, twoColumnBullets,
// categoryValue) look consistent. The section heading is supplied by each
// template's own Section wrapper; this renders only the inner content. Colors
// come from the resolved template style so custom sections honor the selected
// font and colors like every other section.
export default function CustomSectionContent({
  section,
  style,
  atsSafe = false,
}: {
  section: CustomSection;
  style: TemplateStyleSettings;
  // ATS-safe mode: collapse two-column bullets to a single real <ul> list.
  atsSafe?: boolean;
}) {
  switch (section.layoutType) {
    case "freeText":
      return (
        <p style={{ whiteSpace: "pre-wrap" }}>{section.freeText}</p>
      );

    case "bullets": {
      const items = bulletTexts(section);
      return (
        <BulletList
          items={items}
          bulletStyle={section.bulletStyle}
          markerColor={style.primaryColor}
          atsSafe={atsSafe}
        />
      );
    }

    case "twoColumnBullets": {
      const all = bulletTexts(section);
      // ATS-safe: one column so parsers read items in order, not across columns.
      if (atsSafe) {
        return (
          <BulletList
            items={all}
            bulletStyle={section.bulletStyle}
            markerColor={style.primaryColor}
            atsSafe
          />
        );
      }
      const [left, right] = splitIntoBalancedColumns(all);
      return (
        <div className="flex gap-x-8">
          <div className="flex-1">
            <BulletList
              items={left}
              bulletStyle={section.bulletStyle}
              markerColor={style.primaryColor}
            />
          </div>
          {right.length > 0 && (
            <div className="flex-1">
              <BulletList
                items={right}
                bulletStyle={section.bulletStyle}
                markerColor={style.primaryColor}
              />
            </div>
          )}
        </div>
      );
    }

    case "categoryValue":
      return (
        <CategoryValueRows
          items={section.items ?? []}
          categoryColor={style.primaryColor}
        />
      );
  }
}

// Renders Category / Value rows ("Mainframe: COBOL, JCL"). Shared by custom
// sections and the Technical Skills section. `categoryColor` styles the bold
// category label; the value inherits the surrounding text color.
export function CategoryValueRows({
  items,
  categoryColor,
}: {
  items: CustomSectionItem[];
  categoryColor: string;
}) {
  const rows = items.filter((it) => it.category?.trim() || it.value?.trim());
  return (
    <div className="rf-spaced">
      {rows.map((row, i) => (
        <p key={i}>
          {row.category && (
            <span className="font-bold" style={{ color: categoryColor }}>
              {row.category}
              {row.value ? ": " : ""}
            </span>
          )}
          {row.value}
        </p>
      ))}
    </div>
  );
}

// The non-empty bullet texts of a bullets / twoColumnBullets section.
function bulletTexts(section: CustomSection): string[] {
  return (section.items ?? []).map((it) => it.value).filter((v) => v?.trim());
}

// A list rendered with the chosen marker glyph (or none), mirroring the Areas
// of Expertise list treatment.
function BulletList({
  items,
  bulletStyle,
  markerColor,
  atsSafe = false,
}: {
  items: string[];
  bulletStyle: CustomSection["bulletStyle"];
  markerColor: string;
  atsSafe?: boolean;
}) {
  // ATS-safe: a plain native disc list (real <ul>/<li>, no glyph spans).
  if (atsSafe) {
    return (
      <ul className="rf-spaced list-disc pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  const marker = getBulletSymbol(bulletStyle);
  return (
    <ul className="rf-spaced" style={{ listStyle: "none" }}>
      {items.map((item, i) => (
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
}
