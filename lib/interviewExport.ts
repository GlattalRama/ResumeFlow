// Client-side DOCX exporter for selected Interview Coach Q&As.
//
// Mirrors lib/resumeExport.ts: the heavy `docx` library is dynamically
// imported so it stays out of the main bundle and never runs during SSR.
// All user-facing strings arrive pre-localized via `labels` so this module
// stays free of i18n concerns. PDF export is handled separately via the
// browser print dialog (window.print) over the print-styled preview.

export interface InterviewExportItem {
  question: string;
  answer: string;
  topic?: string;
  statusLabel: string;
}

export interface InterviewExportGroup {
  label: string;
  items: InterviewExportItem[];
}

export interface InterviewExportOptions {
  groups: InterviewExportGroup[];
  includeAnswers: boolean;
  fileBaseName: string;
  cover: {
    title: string;
    preparedBy: string;
    // Role/company context line ("Senior Engineer · Acme") or general-practice
    // label; empty string hides the line.
    context: string;
    date: string;
    questionCount: string;
  };
  noAnswerLabel: string;
}

function triggerDownload(blob: Blob, filename: string) {
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

export async function exportInterviewDocx(
  opts: InterviewExportOptions
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, BorderStyle } = await import(
    "docx"
  );

  const FONT = "Calibri";
  const BODY = "333333";
  const MUTED = "6b7280";
  const PRIMARY = "4338ca";

  type Para = InstanceType<typeof Paragraph>;
  const children: Para[] = [];

  // ---- Cover ----
  children.push(
    new Paragraph({
      spacing: { before: 2400, after: 240 },
      children: [
        new TextRun({
          text: opts.cover.title,
          bold: true,
          size: 56,
          color: PRIMARY,
          font: FONT,
        }),
      ],
    })
  );
  for (const line of [
    opts.cover.preparedBy,
    opts.cover.context,
    opts.cover.date,
    opts.cover.questionCount,
  ]) {
    if (!line) continue;
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: line, size: 24, color: MUTED, font: FONT })],
      })
    );
  }

  // ---- Question groups (each category starts on a fresh page) ----
  for (const group of opts.groups) {
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        spacing: { after: 160 },
        border: {
          bottom: { color: PRIMARY, style: BorderStyle.SINGLE, size: 6, space: 1 },
        },
        children: [
          new TextRun({
            text: group.label.toUpperCase(),
            bold: true,
            size: 26,
            color: PRIMARY,
            font: FONT,
          }),
        ],
      })
    );

    group.items.forEach((item, i) => {
      children.push(
        new Paragraph({
          spacing: { before: i === 0 ? 120 : 320, after: 60 },
          keepNext: true,
          children: [
            new TextRun({
              text: `${i + 1}. ${item.question}`,
              bold: true,
              size: 22,
              color: BODY,
              font: FONT,
            }),
          ],
        })
      );
      const meta = [item.topic, item.statusLabel].filter(Boolean).join(" · ");
      if (meta) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            keepNext: opts.includeAnswers,
            children: [
              new TextRun({ text: meta, size: 18, color: MUTED, font: FONT }),
            ],
          })
        );
      }
      if (opts.includeAnswers) {
        const answer = item.answer.trim();
        const paras = answer ? answer.split(/\n+/) : [opts.noAnswerLabel];
        for (const p of paras) {
          children.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: p,
                  size: 21,
                  color: answer ? BODY : MUTED,
                  italics: !answer,
                  font: FONT,
                }),
              ],
            })
          );
        }
      }
    });
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${opts.fileBaseName}.docx`);
}
