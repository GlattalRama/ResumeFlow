// Rich-text helpers for the resume Summary (and any other field that opts in).
//
// The Summary is stored in `basics.summary` as a CONSTRAINED HTML string:
// paragraphs (<p>), unordered/ordered lists (<ul>/<ol> + <li>), and inline
// bold (<strong>), italic (<em>), underline (<u>), strikethrough (<s>).
// Legacy summaries are plain text (no tags) and become one paragraph per line.
//
// Everything here is pure JS (no DOM) so it is safe during server-side
// rendering as well as in the browser and the export code.

export type RichRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

// A block is either a paragraph (runs) or a list (each item is a run array).
export type RichBlock =
  | { type: "paragraph"; runs: RichRun[] }
  | { type: "list"; ordered: boolean; items: RichRun[][] };

// Decode the handful of HTML entities a contentEditable editor emits.
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function runHasText(runs: RichRun[]): boolean {
  return runs.some((r) => r.text.trim() !== "");
}

// Parse a stored summary value (constrained HTML or legacy plain text) into
// paragraph/list blocks. Empty blocks are dropped.
export function parseSummaryToBlocks(
  input: string | null | undefined
): RichBlock[] {
  if (!input) return [];
  let s = String(input).replace(
    /<\s*(script|style)\b[\s\S]*?<\/\s*\1\s*>/gi,
    ""
  );

  // Legacy plain text (no markup): one paragraph per non-empty line.
  if (!/[<]/.test(s)) {
    return s
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: "paragraph" as const, runs: [{ text: line }] }));
  }

  const blocks: RichBlock[] = [];
  let bold = 0;
  let italic = 0;
  let underline = 0;
  let strike = 0;
  let runs: RichRun[] = []; // runs for the current paragraph or list item
  let buf = "";
  let list: { ordered: boolean; items: RichRun[][] } | null = null;
  let inLi = false;

  const resetMarks = () => {
    bold = italic = underline = strike = 0;
  };
  const flushBuf = () => {
    if (!buf) return;
    runs.push({
      text: decodeEntities(buf),
      ...(bold > 0 ? { bold: true } : {}),
      ...(italic > 0 ? { italic: true } : {}),
      ...(underline > 0 ? { underline: true } : {}),
      ...(strike > 0 ? { strike: true } : {}),
    });
    buf = "";
  };
  const flushParagraph = () => {
    flushBuf();
    if (runHasText(runs)) blocks.push({ type: "paragraph", runs });
    runs = [];
    resetMarks();
  };
  const flushListItem = () => {
    flushBuf();
    if (list && runHasText(runs)) list.items.push(runs);
    runs = [];
    resetMarks();
  };
  const flushList = () => {
    if (list && list.items.length) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    }
    list = null;
  };

  const tagRe = /<\/?\s*([a-zA-Z0-9]+)\b[^>]*>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(s))) {
    buf += s.slice(lastIndex, m.index);
    lastIndex = tagRe.lastIndex;
    const name = m[1].toLowerCase();
    const closing = /^<\s*\//.test(m[0]);

    // Inline formatting tags toggle the current marks.
    if (/^(strong|b|em|i|u|s|strike|del)$/.test(name)) {
      flushBuf();
      const d = closing ? -1 : 1;
      if (name === "strong" || name === "b") bold = Math.max(0, bold + d);
      else if (name === "em" || name === "i") italic = Math.max(0, italic + d);
      else if (name === "u") underline = Math.max(0, underline + d);
      else strike = Math.max(0, strike + d); // s / strike / del
      continue;
    }

    if (name === "br") {
      // Line break: paragraph break outside lists, a space inside a list item.
      if (list) buf += " ";
      else flushParagraph();
      continue;
    }
    if (name === "ul" || name === "ol") {
      if (closing) {
        flushListItem();
        flushList();
        inLi = false;
      } else {
        flushParagraph();
        flushList();
        list = { ordered: name === "ol", items: [] };
        inLi = false;
      }
      continue;
    }
    if (name === "li") {
      if (closing) {
        flushListItem();
        inLi = false;
      } else {
        if (inLi) flushListItem();
        inLi = true;
        runs = [];
        resetMarks();
      }
      continue;
    }
    if (name === "p" || name === "div") {
      // Paragraph boundaries are ignored while inside a list (the content stays
      // in the current <li>); otherwise they delimit paragraphs.
      if (!list) flushParagraph();
      continue;
    }
    // Any other tag is stripped (its inner text is preserved in buf).
  }
  buf += s.slice(lastIndex);
  if (list) {
    flushListItem();
    flushList();
  } else {
    flushParagraph();
  }
  return blocks;
}

function runToHtml(r: RichRun): string {
  let t = escapeHtml(r.text);
  if (r.strike) t = `<s>${t}</s>`;
  if (r.underline) t = `<u>${t}</u>`;
  if (r.italic) t = `<em>${t}</em>`;
  if (r.bold) t = `<strong>${t}</strong>`;
  return t;
}

// Serialize blocks back to canonical, clean HTML for storage.
export function blocksToHtml(blocks: RichBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph") {
        return `<p>${b.runs.map(runToHtml).join("")}</p>`;
      }
      const tag = b.ordered ? "ol" : "ul";
      const items = b.items
        .map((it) => `<li>${it.map(runToHtml).join("")}</li>`)
        .join("");
      return `<${tag}>${items}</${tag}>`;
    })
    .join("");
}

// Normalize any incoming summary value (editor HTML or legacy text) to the
// canonical constrained-HTML form. Returns "" when there is no real content.
export function sanitizeSummaryHtml(input: string | null | undefined): string {
  return blocksToHtml(parseSummaryToBlocks(input));
}

// Flatten blocks to plain text. Used for height estimation and plain-text-only
// consumers. List items are prefixed with a bullet glyph.
export function blocksToPlainText(blocks: RichBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph") return b.runs.map((r) => r.text).join("");
      return b.items
        .map(
          (it, i) =>
            `${b.ordered ? `${i + 1}. ` : "• "}${it.map((r) => r.text).join("")}`
        )
        .join("\n");
    })
    .join("\n\n");
}
