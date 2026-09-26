// Client-side resume exporters for DOCX and PPTX.
//
// Both run entirely in the browser using the selected resume JSON data and the
// resolved template style settings (font + colors). The heavy `docx` /
// `pptxgenjs` libraries are dynamically imported so they stay out of the main
// bundle and never run during SSR.
//
// Section order/visibility is driven by `orderedVisibleSections` (constants) so
// the DOCX and PPTX exports render the same sections, in the same user-chosen
// order, as the live preview and PDF. The header (name/title/contact) is always
// rendered first and is not a reorderable section.
//
// PDF export is handled separately by /api/resumes/[id]/pdf (headless Chromium
// prints the live, fully-styled preview page server-side).
import type {
  CustomSection,
  ResumeBulletStyle,
  ResumeData,
  ResumeSectionId,
  ResumeSectionState,
  TemplateStyleSettings,
} from "./types";
import { DEFAULT_PROFILE_PHOTO_POSITION } from "./types";
import { saveAndShareNative } from "./nativeDownload";
import {
  customSectionLabel,
  DEFAULT_FONT_SCALE,
  extraContactEntries,
  fontExportName,
  getBulletSymbol,
  normalizeResumeData,
  orderedVisibleDocSections,
  resolveSectionLabels,
  resolveSkillCategories,
  resolveTemplateStyle,
  splitIntoBalancedColumns,
  visibleLocation,
} from "./constants";
import {
  blocksToPlainText,
  parseInlineRuns,
  parseSummaryToBlocks,
} from "./richText";

// Map an Areas of Expertise bullet style to a pptxgenjs `bullet` text option:
// native disc for "bullet", no bullet for "none", and a Unicode glyph
// (dash/check/arrow) via characterCode for the rest.
function pptxAreaBullet(
  style: ResumeBulletStyle
): boolean | { characterCode: string } {
  switch (style) {
    case "none":
      return false;
    case "dash":
      return { characterCode: "2013" };
    case "check":
      return { characterCode: "2713" };
    case "arrow":
      return { characterCode: "2192" };
    case "bullet":
    default:
      return true;
  }
}

// docx/pptxgenjs want hex colors WITHOUT the leading "#".
function hex(color: string): string {
  return color.replace(/^#/, "");
}

export function fileBaseName(data: ResumeData): string {
  const name = data.basics.name?.trim() || "resume";
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "resume";
}

export async function triggerDownload(blob: Blob, filename: string) {
  // Capacitor shells can't run the blob-anchor download below — hand the file
  // to the OS share sheet instead (falls through on the web / old app builds).
  if (await saveAndShareNative(blob, filename)) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateRange(start: string, end: string): string {
  return [start, end].filter(Boolean).join(" - ");
}

// CSS reference pixel → twips (1in = 96px = 1440 twips).
const TWIPS_PER_PX = 15;
const TWIPS_PER_MM = 1440 / 25.4;

// Header photo frame, matching the ATS Corporate template's classes
// (`h-28 w-28 rounded-full` / `h-28 w-32 rounded-md`) in CSS pixels.
const PHOTO_FRAME = {
  circle: { width: 112, height: 112 },
  square: { width: 128, height: 112 },
} as const;

/**
 * Fetch the profile photo and cover-crop it to the template's frame (same
 * focal point as the preview's `object-position`), rasterised as a PNG so the
 * circle shape and rounded corners survive in Word. Returns null when there is
 * no photo or it can't be loaded (the export then simply omits it).
 */
async function loadProfilePhotoPng(
  data: ResumeData
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const src = data.profilePhotoMeta?.driveFileId
    ? `/api/drive/photos/${data.profilePhotoMeta.driveFileId}`
    : data.profilePhoto;
  if (!src || typeof document === "undefined") return null;
  const shape = data.profilePhotoShape === "circle" ? "circle" : "square";
  const frame = PHOTO_FRAME[shape];
  const pos = data.profilePhotoPosition ?? DEFAULT_PROFILE_PHOTO_POSITION;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    // Render at 2× for a crisp print while keeping the frame's CSS size.
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = frame.width * scale;
    canvas.height = frame.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const W = canvas.width;
    const H = canvas.height;
    const radius = shape === "circle" ? W / 2 : 6 * scale;
    const clip = () => {
      ctx.beginPath();
      if (shape === "circle") ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
      else ctx.roundRect(0, 0, W, H, radius);
      ctx.closePath();
    };
    clip();
    ctx.save();
    ctx.clip();
    // object-fit: cover + object-position: x% y%.
    const cover = Math.max(W / bitmap.width, H / bitmap.height);
    const sw = W / cover;
    const sh = H / cover;
    const sx = (bitmap.width - sw) * (pos.x / 100);
    const sy = (bitmap.height - sh) * (pos.y / 100);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, W, H);
    ctx.restore();
    // 1px light border, as in the preview (border-gray-200).
    clip();
    ctx.lineWidth = scale;
    ctx.strokeStyle = "#e5e7eb";
    ctx.stroke();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return null;
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: frame.width,
      height: frame.height,
    };
  } catch {
    return null;
  }
}

// ---- DOCX ----

export async function exportResumeDocx(
  data: ResumeData,
  style?: TemplateStyleSettings,
  sectionState?: ResumeSectionState[] | null,
  // ATS-safe mode: plain single-line header (no photo), and Areas of Expertise
  // / two-column custom bullets as a single-column list instead of a
  // (parser-unfriendly) two-cell table. Mirrors the ATS Corporate template.
  atsSafe = false
): Promise<void> {
  data = normalizeResumeData(data); // backfill legacy/partial records
  const s = resolveTemplateStyle(style);
  const font = fontExportName(s.fontFamily);
  const primary = hex(s.primaryColor);
  const body = hex(s.bodyColor);
  const muted = hex(s.mutedColor);
  const line = hex(s.sectionLineColor);
  // Resolved section headings (customTitle || defaultTitle) keyed by section id.
  const labels = resolveSectionLabels(sectionState);

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    BorderStyle,
    Table,
    TableRow,
    TableCell,
    WidthType,
    LineRuleType,
    PageBreak,
    ImageRun,
    AlignmentType,
    VerticalAlign,
    TableLayoutType,
  } = await import("docx");

  // Map the per-version line-spacing settings to Word units:
  //   • line height  -> spacing.line in 240ths of a line (240 = single)
  //   • section gap  -> spacing.before in twips (1rem ≈ 240 twips = 12pt)
  //   • bullet gap   -> spacing.after on list/row items (twips)
  // Scale every run size by the chosen base font size. The existing sizes are
  // tuned for the default 13px base (body 10pt), so fs(x) = x at the default.
  const fs = (halfPoints: number) =>
    Math.round((halfPoints * s.fontSize) / 13);
  // Name / heading sizes also honor the per-element multipliers, scaled relative
  // to the default proportions so DOCX matches the preview.
  const nameSize = Math.round((fs(36) * s.fontScale.name) / DEFAULT_FONT_SCALE.name);
  const headingSize = Math.round(
    (fs(22) * s.fontScale.heading) / DEFAULT_FONT_SCALE.heading
  );
  const TWIPS_PER_REM = 240;
  const lineVal = Math.round(s.lineSpacing.text * 240);
  const sectionBefore = Math.round(s.lineSpacing.section * TWIPS_PER_REM);
  const bulletAfter = Math.round(s.lineSpacing.bullet * TWIPS_PER_REM);
  const bodySpacing = { line: lineVal, lineRule: LineRuleType.AUTO };
  const itemSpacing = {
    line: lineVal,
    lineRule: LineRuleType.AUTO,
    after: bulletAfter,
  };

  type DocxChild = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const { basics } = data;
  const children: DocxChild[] = [];

  // A borderless table cell (used for the header and two-column lists).
  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const CELL_BORDERS = {
    top: NO_BORDER,
    bottom: NO_BORDER,
    left: NO_BORDER,
    right: NO_BORDER,
  };
  const NO_TABLE_BORDERS = {
    ...CELL_BORDERS,
    insideHorizontal: NO_BORDER,
    insideVertical: NO_BORDER,
  };

  // Header — same colors as the template: name in the body color, title in
  // the primary color, contact details in the muted color.
  const namePara = new Paragraph({
    children: [
      new TextRun({
        text: basics.name || "Your Name",
        bold: true,
        size: nameSize,
        color: body,
        font,
      }),
    ],
  });
  const titlePara = basics.title
    ? new Paragraph({
        spacing: { before: 60 },
        children: [
          new TextRun({
            text: basics.title,
            size: Math.round(fs(20) * 1.08),
            color: primary,
            font,
          }),
        ],
      })
    : null;
  const contactEntries = [
    basics.email,
    basics.phone,
    visibleLocation(basics),
    basics.website,
    ...extraContactEntries(basics),
  ].filter(Boolean);

  if (atsSafe) {
    // ATS-safe header: plain name/title and one contact line — the simplest
    // block for a parser to read (no photo, no table).
    children.push(namePara);
    if (titlePara) children.push(titlePara);
    if (contactEntries.length) {
      children.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [
            new TextRun({
              text: contactEntries.join("  |  "),
              size: fs(18),
              color: muted,
              font,
            }),
          ],
        })
      );
    }
  } else {
    // Template header: photo on the left, name + title in the middle, and a
    // right-aligned contact column — laid out as a borderless table.
    const photo = await loadProfilePhotoPng(data);
    const contentWidth = Math.round(
      (210 - s.pageMargins.left - s.pageMargins.right) * TWIPS_PER_MM
    );
    // Photo column = frame + the template's 1.5rem gap; contact column sized
    // to its longest entry (≈ 0.55em per character at the contact size).
    const photoCol = photo ? Math.round((photo.width + 24) * TWIPS_PER_PX) : 0;
    const longest = contactEntries.reduce((n, e) => Math.max(n, e.length), 0);
    const contactCol = contactEntries.length
      ? Math.min(
          Math.round(contentWidth * 0.4),
          Math.round(longest * 0.55 * (fs(18) / 2) * 20) + 240
        )
      : 0;
    const nameCol = Math.max(contentWidth - photoCol - contactCol, 1440);
    const cells = [];
    if (photo) {
      cells.push(
        new TableCell({
          width: { size: photoCol, type: WidthType.DXA },
          borders: CELL_BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  type: "png",
                  data: photo.bytes,
                  transformation: { width: photo.width, height: photo.height },
                  altText: {
                    title: "Profile photo",
                    description: basics.name || "Profile photo",
                    name: "profile-photo",
                  },
                }),
              ],
            }),
          ],
        })
      );
    }
    cells.push(
      new TableCell({
        width: { size: nameCol, type: WidthType.DXA },
        borders: CELL_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        children: titlePara ? [namePara, titlePara] : [namePara],
      })
    );
    if (contactEntries.length) {
      cells.push(
        new TableCell({
          width: { size: contactCol, type: WidthType.DXA },
          borders: CELL_BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          children: contactEntries.map(
            (entry) =>
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 40 },
                children: [
                  new TextRun({ text: entry, size: fs(18), color: body, font }),
                ],
              })
          ),
        })
      );
    }
    children.push(
      new Table({
        width: { size: contentWidth, type: WidthType.DXA },
        columnWidths: cells.map((_, i) =>
          photo && i === 0 ? photoCol : i === cells.length - 1 && contactEntries.length ? contactCol : nameCol
        ),
        layout: TableLayoutType.FIXED,
        borders: NO_TABLE_BORDERS,
        rows: [new TableRow({ children: cells })],
      })
    );
  }

  // Section heading with an underline rule in the primary/section-line color.
  function heading(title: string) {
    return new Paragraph({
      spacing: { before: sectionBefore, after: 80, line: lineVal, lineRule: LineRuleType.AUTO },
      border: {
        bottom: { color: line, style: BorderStyle.SINGLE, size: 6, space: 1 },
      },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: headingSize,
          color: primary,
          font,
        }),
      ],
    });
  }
  function bodyPara(
    text: string,
    opts: { bold?: boolean; color?: string; after?: number } = {}
  ) {
    return new Paragraph({
      spacing:
        opts.after != null ? { ...bodySpacing, after: opts.after } : bodySpacing,
      children: [
        new TextRun({
          text,
          bold: opts.bold,
          size: fs(20),
          color: opts.color ?? body,
          font,
        }),
      ],
    });
  }
  function bullet(text: string) {
    return new Paragraph({
      bullet: { level: 0 },
      spacing: itemSpacing,
      children: [new TextRun({ text, size: fs(20), color: body, font })],
    });
  }
  // A bulleted item whose text may carry inline marks (e.g. a highlight).
  function bulletRich(value: string) {
    const runs = parseInlineRuns(value);
    return new Paragraph({
      bullet: { level: 0 },
      spacing: itemSpacing,
      children: runs.length
        ? runs.map(richRun)
        : [new TextRun({ text: "", size: fs(20), color: body, font })],
    });
  }
  // A rich-text run (bold/italic/underline/strike) -> docx TextRun.
  function richRun(r: {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
  }) {
    return new TextRun({
      text: r.text,
      bold: r.bold,
      italics: r.italic,
      underline: r.underline ? {} : undefined,
      strike: r.strike,
      size: fs(20),
      color: body,
      font,
    });
  }
  // Rich-text value (e.g. Summary) -> docx paragraphs, preserving paragraphs,
  // bullet/numbered lists, and inline marks. Falls back to one empty paragraph.
  function richTextParas(value: string) {
    const blocks = parseSummaryToBlocks(value);
    if (blocks.length === 0) return [bodyPara("")];
    const out: ReturnType<typeof bodyPara>[] = [];
    for (const b of blocks) {
      if (b.type === "paragraph") {
        out.push(
          new Paragraph({ spacing: bodySpacing, children: b.runs.map(richRun) })
        );
      } else {
        b.items.forEach((item, i) => {
          out.push(
            b.ordered
              ? new Paragraph({
                  spacing: itemSpacing,
                  children: [
                    new TextRun({
                      text: `${i + 1}. `,
                      size: fs(20),
                      color: body,
                      font,
                    }),
                    ...item.map(richRun),
                  ],
                })
              : new Paragraph({
                  bullet: { level: 0 },
                  spacing: itemSpacing,
                  children: item.map(richRun),
                })
          );
        });
      }
    }
    return out;
  }
  // Areas of Expertise honor the selected marker style as closely as Word
  // allows: a native bullet list for "bullet", a plain paragraph for "none",
  // and a glyph-prefixed paragraph (•/–/✓/→) for the other styles.
  function areaItem(text: string) {
    return markerBullet(text, data.areasOfExpertiseBulletStyle ?? "bullet");
  }
  // A borderless table cell holding one column of Areas of Expertise items.
  function areaColumnCell(col: string[]) {
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: CELL_BORDERS,
      // A cell must contain at least one paragraph.
      children: col.length ? col.map(areaItem) : [bodyPara("")],
    });
  }

  // A bullet honoring an arbitrary marker style (Areas of Expertise and custom
  // sections): a native bullet list for "bullet", a plain paragraph for "none",
  // and a glyph-prefixed paragraph (–/✓/→) for the rest, with the glyph in the
  // primary color exactly like the preview.
  function markerBullet(text: string, style: ResumeBulletStyle) {
    if (style === "bullet") return bullet(text);
    const marker = getBulletSymbol(style);
    if (!marker) return bodyPara(text, { after: bulletAfter });
    return new Paragraph({
      spacing: itemSpacing,
      children: [
        new TextRun({ text: `${marker} `, size: fs(20), color: primary, font }),
        new TextRun({ text, size: fs(20), color: body, font }),
      ],
    });
  }
  function bulletColumnCell(col: string[], style: ResumeBulletStyle) {
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: CELL_BORDERS,
      children: col.length ? col.map((t) => markerBullet(t, style)) : [bodyPara("")],
    });
  }

  // One builder per default section. Returns the section's heading + content as
  // a flat child list. orderedVisibleDocSections decides which run, in what
  // order, and interleaves the custom sections below.
  const sectionBuilders: Record<ResumeSectionId, () => DocxChild[]> = {
    summary: () => [heading(labels.summary), ...richTextParas(basics.summary)],
    areas: () => {
      const items = data.areasOfExpertise ?? [];
      // ATS-safe: a single-column bulleted list (no table) for clean parsing.
      if (atsSafe) {
        return [heading(labels.areas), ...items.map(areaItem)];
      }
      const [left, right] = splitIntoBalancedColumns(items);
      return [
        heading(labels.areas),
        // Balanced two columns (left fills first) via a borderless table so the
        // two-column layout is preserved in Word.
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: NO_TABLE_BORDERS,
          rows: [
            new TableRow({
              children: [areaColumnCell(left), areaColumnCell(right)],
            }),
          ],
        }),
      ];
    },
    skills: () => {
      const out: DocxChild[] = [heading(labels.skills)];
      resolveSkillCategories(data).forEach((row) => {
        if (!(row.category?.trim() || row.value?.trim())) return;
        out.push(
          new Paragraph({
            spacing: itemSpacing,
            children: [
              new TextRun({
                text: row.category ? `${row.category}: ` : "",
                bold: true,
                size: fs(20),
                color: primary,
                font,
              }),
              new TextRun({ text: row.value, size: fs(20), color: body, font }),
            ],
          })
        );
      });
      return out;
    },
    experience: () => {
      const out: DocxChild[] = [heading(labels.experience)];
      data.experience.forEach((exp) => {
        const title = [exp.role, exp.company].filter(Boolean).join(", ");
        out.push(bodyPara(title || "—", { bold: true }));
        const meta = [exp.location, dateRange(exp.startDate, exp.endDate)]
          .filter(Boolean)
          .join(" | ");
        if (meta) out.push(bodyPara(meta, { color: muted }));
        exp.highlights.forEach((h) => out.push(bulletRich(h)));
      });
      return out;
    },
    projects: () => {
      const out: DocxChild[] = [heading(labels.projects)];
      data.projects.forEach((p) => {
        out.push(bodyPara(p.name || "—", { bold: true }));
        if (p.description) out.push(bodyPara(p.description));
        if (p.link) out.push(bodyPara(p.link, { color: muted }));
      });
      return out;
    },
    education: () => {
      const out: DocxChild[] = [heading(labels.education)];
      data.education.forEach((ed) => {
        out.push(bodyPara(ed.school || "—", { bold: true }));
        const meta = [
          [ed.degree, ed.field].filter(Boolean).join(", "),
          dateRange(ed.startDate, ed.endDate),
        ]
          .filter(Boolean)
          .join(" | ");
        if (meta) out.push(bodyPara(meta, { color: muted }));
      });
      return out;
    },
    certifications: () => [
      heading(labels.certifications),
      ...data.certifications.map((c) => bullet(c)),
    ],
    languages: () => [
      heading(labels.languages),
      bodyPara((data.languages ?? []).join(", ")),
    ],
  };

  // A user-defined custom section: heading + content per its layout type.
  function customSectionChildren(section: CustomSection): DocxChild[] {
    const out: DocxChild[] = [heading(customSectionLabel(section))];
    const texts = (section.items ?? [])
      .map((it) => it.value)
      .filter((v) => v?.trim());
    switch (section.layoutType) {
      case "freeText":
        // The preview renders this pre-wrap, so keep every line break.
        (section.freeText ?? "")
          .split(/\r?\n/)
          .forEach((line) => out.push(bodyPara(line)));
        break;
      case "bullets":
        texts.forEach((t) => out.push(markerBullet(t, section.bulletStyle)));
        break;
      case "twoColumnBullets": {
        // ATS-safe: collapse to a single-column list (no table).
        if (atsSafe) {
          texts.forEach((t) => out.push(markerBullet(t, section.bulletStyle)));
          break;
        }
        const [left, right] = splitIntoBalancedColumns(texts);
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  bulletColumnCell(left, section.bulletStyle),
                  bulletColumnCell(right, section.bulletStyle),
                ],
              }),
            ],
          })
        );
        break;
      }
      case "categoryValue":
        (section.items ?? []).forEach((row) => {
          if (!(row.category?.trim() || row.value?.trim())) return;
          out.push(
            new Paragraph({
              spacing: itemSpacing,
              children: [
                new TextRun({
                  text: row.category ? `${row.category}: ` : "",
                  bold: true,
                  size: fs(20),
                  color: primary,
                  font,
                }),
                new TextRun({ text: row.value, size: fs(20), color: body, font }),
              ],
            })
          );
        });
        break;
    }
    return out;
  }

  const docSections = orderedVisibleDocSections(data, sectionState);
  docSections.forEach((entry, i) => {
    if (entry.kind === "custom") {
      children.push(...customSectionChildren(entry.section));
    } else {
      children.push(...sectionBuilders[entry.sectionId]());
    }
    // Honor "page break after this section" like the preview / PDF (not after
    // the last section, which would add an empty trailing page).
    if (entry.pageBreakAfter && i < docSections.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  // A4 with the resume's own page margins, so Word wraps and paginates like
  // the preview / PDF instead of using its 1-inch default.
  const m = s.pageMargins;
  const twips = (mm: number) => Math.round(mm * TWIPS_PER_MM);
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: twips(210), height: twips(297) },
            margin: {
              top: twips(m.top),
              right: twips(m.right),
              bottom: twips(m.bottom),
              left: twips(m.left),
            },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  await triggerDownload(blob, `${fileBaseName(data)}.docx`);
}

// ---- PPTX ----

export async function exportResumePptx(
  data: ResumeData,
  style?: TemplateStyleSettings,
  sectionState?: ResumeSectionState[] | null
): Promise<void> {
  data = normalizeResumeData(data); // backfill legacy/partial records
  const s = resolveTemplateStyle(style);
  const font = fontExportName(s.fontFamily);
  const primary = hex(s.primaryColor);
  const body = hex(s.bodyColor);
  const muted = hex(s.mutedColor);
  // Resolved section headings (customTitle || defaultTitle) keyed by section id.
  const labels = resolveSectionLabels(sectionState);
  // Scale every point size by the chosen base font size; the slide sizes are
  // tuned for the default 13px base, so pf(x) = x at the default.
  const pf = (pt: number) => Math.round((pt * s.fontSize) / 13);
  // Name / heading sizes honor the per-element multipliers, scaled relative to
  // the default proportions so the deck matches the preview.
  const namePt = Math.round((pf(36) * s.fontScale.name) / DEFAULT_FONT_SCALE.name);
  const headingPt = Math.round(
    (pf(20) * s.fontScale.heading) / DEFAULT_FONT_SCALE.heading
  );

  const pptxgenModule = await import("pptxgenjs");
  const PptxGen = pptxgenModule.default;
  const pptx = new PptxGen();
  pptx.defineLayout({ name: "RF_WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "RF_WIDE";

  const { basics } = data;
  const MARGIN = 0.6;
  const WIDTH = 13.33 - MARGIN * 2;
  const PAGE_TOP = 0.6;
  const PAGE_BOTTOM = 7.0;

  // Auto-flow cursor: sections are placed sequentially down the slide and spill
  // onto a new slide when they run out of vertical room. This lets sections
  // render in ANY order (instead of fixed per-section slides).
  let slide: ReturnType<typeof pptx.addSlide> | null = null;
  let y = PAGE_TOP;
  function newSlide() {
    slide = pptx.addSlide();
    y = PAGE_TOP;
  }
  // Ensure `h` inches are available below the cursor, starting a new slide if
  // not. Always returns a non-null slide.
  function ensure(h: number): ReturnType<typeof pptx.addSlide> {
    if (!slide || y + h > PAGE_BOTTOM) newSlide();
    return slide as ReturnType<typeof pptx.addSlide>;
  }

  // Rough text-block height (inches) from character count, used to decide when
  // to break to a new slide. Intentionally conservative.
  function textHeight(text: string, fontSize: number, width = WIDTH): number {
    const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.0095)));
    const lines = Math.max(1, Math.ceil((text?.length ?? 0) / charsPerLine));
    const lineH = (fontSize / 72) * 1.35;
    return lines * lineH + 0.15;
  }

  // Section heading; keeps the title together with at least ~one line of body.
  function sectionTitle(text: string) {
    const sl = ensure(1.0);
    sl.addText(text.toUpperCase(), {
      x: MARGIN,
      y,
      w: WIDTH,
      h: 0.5,
      fontFace: font,
      fontSize: headingPt,
      bold: true,
      color: primary,
    });
    y += 0.6;
  }

  // ---- Header (always first, not a reorderable section) ----
  newSlide();
  slide!.addText(basics.name || "Your Name", {
    x: MARGIN,
    y,
    w: WIDTH,
    h: 0.9,
    fontFace: font,
    fontSize: namePt,
    bold: true,
    color: primary,
  });
  y += 0.9;
  if (basics.title) {
    slide!.addText(basics.title, {
      x: MARGIN,
      y,
      w: WIDTH,
      h: 0.5,
      fontFace: font,
      fontSize: pf(18),
      color: body,
    });
    y += 0.5;
  }
  const contact = [basics.email, basics.phone, visibleLocation(basics), basics.website, ...extraContactEntries(basics)]
    .filter(Boolean)
    .join("   |   ");
  if (contact) {
    slide!.addText(contact, {
      x: MARGIN,
      y,
      w: WIDTH,
      h: 0.4,
      fontFace: font,
      fontSize: pf(12),
      color: muted,
    });
    y += 0.5;
  }
  y += 0.2;

  // ---- Section renderers (one per section id) ----
  function renderSummary() {
    sectionTitle(labels.summary);
    const blocks = parseSummaryToBlocks(basics.summary);
    const plain = blocksToPlainText(blocks) || basics.summary;
    const h = textHeight(plain, pf(14));
    const sl = ensure(h);

    // Build pptx text runs. Each paragraph/list-item ends with a line break;
    // list items carry a bullet (disc or number). Inline marks per run.
    type PptxRun = { text: string; options: Record<string, unknown> };
    const runs: PptxRun[] = [];
    const inline = (r: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strike?: boolean;
    }) => ({
      bold: r.bold,
      italic: r.italic,
      underline: r.underline ? { style: "sng" as const } : undefined,
      strike: r.strike,
    });

    if (blocks.length > 0) {
      blocks.forEach((block, bi) => {
        const lastBlock = bi === blocks.length - 1;
        if (block.type === "paragraph") {
          block.runs.forEach((r, ri) => {
            runs.push({
              text: r.text,
              options: {
                ...inline(r),
                breakLine: ri === block.runs.length - 1 && !lastBlock,
              },
            });
          });
        } else {
          block.items.forEach((item, ii) => {
            const lastItem = ii === block.items.length - 1;
            item.forEach((r, ri) => {
              runs.push({
                text: r.text,
                options: {
                  ...inline(r),
                  bullet: block.ordered ? { type: "number" } : true,
                  breakLine: ri === item.length - 1 && !(lastBlock && lastItem),
                },
              });
            });
          });
        }
      });
    } else {
      runs.push({ text: basics.summary, options: {} });
    }

    sl.addText(runs, {
      x: MARGIN,
      y,
      w: WIDTH,
      h,
      fontFace: font,
      fontSize: pf(14),
      color: body,
      valign: "top",
    });
    y += h + 0.2;
  }

  function renderAreas() {
    sectionTitle(labels.areas);
    const areas = data.areasOfExpertise ?? [];
    const areaBullet = pptxAreaBullet(data.areasOfExpertiseBulletStyle ?? "bullet");
    const [left, right] = splitIntoBalancedColumns(areas);
    const COL_GAP = 0.4;
    const colW = (WIDTH - COL_GAP) / 2;
    const h = Math.max(left.length, right.length) * 0.3 + 0.2;
    const sl = ensure(h);
    const colText = (col: string[], x: number) =>
      sl.addText(
        col.map((a) => ({ text: a, options: { bullet: areaBullet } })),
        {
          x,
          y,
          w: colW,
          h,
          fontFace: font,
          fontSize: pf(14),
          color: body,
          valign: "top",
        }
      );
    colText(left, MARGIN);
    if (right.length > 0) colText(right, MARGIN + colW + COL_GAP);
    y += h + 0.2;
  }

  function renderSkills() {
    sectionTitle(labels.skills);
    const lines = resolveSkillCategories(data)
      .filter((r) => r.category?.trim() || r.value?.trim())
      .map((r) => (r.category ? `${r.category}: ${r.value}` : r.value));
    const h = lines.length * 0.3 + 0.2;
    const sl = ensure(h);
    sl.addText(lines.join("\n"), {
      x: MARGIN,
      y,
      w: WIDTH,
      h,
      fontFace: font,
      fontSize: pf(14),
      color: body,
      valign: "top",
    });
    y += h + 0.2;
  }

  function renderExperience() {
    sectionTitle(labels.experience);
    data.experience.forEach((exp) => {
      const title = [exp.role, exp.company].filter(Boolean).join(", ");
      const meta = [exp.location, dateRange(exp.startDate, exp.endDate)]
        .filter(Boolean)
        .join("   |   ");
      const highlightsH =
        exp.highlights.length > 0 ? exp.highlights.length * 0.28 + 0.1 : 0;
      const entryH = 0.35 + (meta ? 0.3 : 0) + highlightsH + 0.2;
      const sl = ensure(entryH);
      sl.addText(title || "—", {
        x: MARGIN,
        y,
        w: WIDTH,
        h: 0.35,
        fontFace: font,
        fontSize: pf(15),
        bold: true,
        color: body,
      });
      y += 0.35;
      if (meta) {
        sl.addText(meta, {
          x: MARGIN,
          y,
          w: WIDTH,
          h: 0.3,
          fontFace: font,
          fontSize: pf(11),
          color: muted,
        });
        y += 0.3;
      }
      if (exp.highlights.length > 0) {
        sl.addText(
          exp.highlights.flatMap((h) => {
            const runs = parseInlineRuns(h);
            const list = runs.length ? runs : [{ text: "" }];
            return list.map((r, ri) => ({
              text: r.text,
              options: {
                bullet: true,
                bold: r.bold,
                italic: r.italic,
                underline: r.underline ? { style: "sng" as const } : undefined,
                strike: r.strike,
                breakLine: ri === list.length - 1,
              },
            }));
          }),
          {
            x: MARGIN,
            y,
            w: WIDTH,
            h: highlightsH,
            fontFace: font,
            fontSize: pf(12),
            color: body,
            valign: "top",
          }
        );
        y += highlightsH;
      }
      y += 0.2;
    });
  }

  function renderProjects() {
    sectionTitle(labels.projects);
    data.projects.forEach((p) => {
      const descH = p.description ? textHeight(p.description, pf(12)) : 0;
      const entryH = 0.35 + descH + (p.link ? 0.3 : 0) + 0.2;
      const sl = ensure(entryH);
      sl.addText(p.name || "—", {
        x: MARGIN,
        y,
        w: WIDTH,
        h: 0.35,
        fontFace: font,
        fontSize: pf(15),
        bold: true,
        color: body,
      });
      y += 0.35;
      if (p.description) {
        sl.addText(p.description, {
          x: MARGIN,
          y,
          w: WIDTH,
          h: descH,
          fontFace: font,
          fontSize: pf(12),
          color: body,
          valign: "top",
        });
        y += descH;
      }
      if (p.link) {
        sl.addText(p.link, {
          x: MARGIN,
          y,
          w: WIDTH,
          h: 0.3,
          fontFace: font,
          fontSize: pf(11),
          color: muted,
        });
        y += 0.3;
      }
      y += 0.2;
    });
  }

  function renderEducation() {
    sectionTitle(labels.education);
    data.education.forEach((ed) => {
      const line = [
        ed.school,
        [ed.degree, ed.field].filter(Boolean).join(", "),
        dateRange(ed.startDate, ed.endDate),
      ]
        .filter(Boolean)
        .join("  —  ");
      const sl = ensure(0.4);
      sl.addText(line || "—", {
        x: MARGIN,
        y,
        w: WIDTH,
        h: 0.35,
        fontFace: font,
        fontSize: pf(13),
        color: body,
      });
      y += 0.4;
    });
    y += 0.2;
  }

  function renderCertifications() {
    sectionTitle(labels.certifications);
    const h = data.certifications.length * 0.3 + 0.2;
    const sl = ensure(h);
    sl.addText(
      data.certifications.map((c) => ({ text: c, options: { bullet: true } })),
      {
        x: MARGIN,
        y,
        w: WIDTH,
        h,
        fontFace: font,
        fontSize: pf(13),
        color: body,
        valign: "top",
      }
    );
    y += h + 0.2;
  }

  function renderLanguages() {
    sectionTitle(labels.languages);
    const text = (data.languages ?? []).join(", ");
    const h = textHeight(text, pf(13));
    const sl = ensure(h);
    sl.addText(text, {
      x: MARGIN,
      y,
      w: WIDTH,
      h,
      fontFace: font,
      fontSize: pf(13),
      color: body,
      valign: "top",
    });
    y += h + 0.2;
  }

  // A user-defined custom section, auto-flowing like the default sections.
  function renderCustomSection(section: CustomSection) {
    sectionTitle(customSectionLabel(section));
    const texts = (section.items ?? [])
      .map((it) => it.value)
      .filter((v) => v?.trim());
    switch (section.layoutType) {
      case "freeText": {
        const h = textHeight(section.freeText, pf(14));
        const sl = ensure(h);
        sl.addText(section.freeText, {
          x: MARGIN,
          y,
          w: WIDTH,
          h,
          fontFace: font,
          fontSize: pf(14),
          color: body,
          valign: "top",
        });
        y += h + 0.2;
        break;
      }
      case "bullets": {
        const b = pptxAreaBullet(section.bulletStyle);
        const h = texts.length * 0.3 + 0.2;
        const sl = ensure(h);
        sl.addText(
          texts.map((t) => ({ text: t, options: { bullet: b } })),
          {
            x: MARGIN,
            y,
            w: WIDTH,
            h,
            fontFace: font,
            fontSize: pf(14),
            color: body,
            valign: "top",
          }
        );
        y += h + 0.2;
        break;
      }
      case "twoColumnBullets": {
        const b = pptxAreaBullet(section.bulletStyle);
        const [left, right] = splitIntoBalancedColumns(texts);
        const COL_GAP = 0.4;
        const colW = (WIDTH - COL_GAP) / 2;
        const h = Math.max(left.length, right.length) * 0.3 + 0.2;
        const sl = ensure(h);
        const colText = (col: string[], x: number) =>
          sl.addText(
            col.map((t) => ({ text: t, options: { bullet: b } })),
            {
              x,
              y,
              w: colW,
              h,
              fontFace: font,
              fontSize: pf(14),
              color: body,
              valign: "top",
            }
          );
        colText(left, MARGIN);
        if (right.length > 0) colText(right, MARGIN + colW + COL_GAP);
        y += h + 0.2;
        break;
      }
      case "categoryValue": {
        const lines = (section.items ?? [])
          .filter((r) => r.category?.trim() || r.value?.trim())
          .map((r) => (r.category ? `${r.category}: ${r.value}` : r.value));
        const h = lines.length * 0.3 + 0.2;
        const sl = ensure(h);
        sl.addText(lines.join("\n"), {
          x: MARGIN,
          y,
          w: WIDTH,
          h,
          fontFace: font,
          fontSize: pf(13),
          color: body,
          valign: "top",
        });
        y += h + 0.2;
        break;
      }
    }
  }

  const renderers: Record<ResumeSectionId, () => void> = {
    summary: renderSummary,
    areas: renderAreas,
    skills: renderSkills,
    experience: renderExperience,
    projects: renderProjects,
    education: renderEducation,
    certifications: renderCertifications,
    languages: renderLanguages,
  };

  for (const entry of orderedVisibleDocSections(data, sectionState)) {
    if (entry.kind === "custom") {
      renderCustomSection(entry.section);
    } else {
      renderers[entry.sectionId]();
    }
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  await triggerDownload(blob, `${fileBaseName(data)}.pptx`);
}
