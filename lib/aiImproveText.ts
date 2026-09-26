// Turn a raw "Improve with AI" response into the constrained HTML the resume
// fields store, so accepting a suggestion never strips the user's formatting.
// The model is asked for constrained HTML but may still answer with plain text,
// markdown fences, list markers, or stray tags — everything here is tolerant of
// that and pure (no DOM), so it also runs during streaming previews.
import {
  htmlToLines,
  parseInlineRuns,
  runsToHtml,
  sanitizeSummaryHtml,
} from "./richText";

// Drop a ```html … ``` (or ```) wrapper the model sometimes adds.
export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?\s*```\s*$/, "")
    .trim();
}

// Remove a leading "- ", "• ", "* " or "1. " bullet marker from one line.
function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:[-*•·▪◦]|\d+[.)])\s+/, "");
}

// Summary suggestion → canonical block HTML ("" when empty).
export function normalizeSummarySuggestion(raw: string): string {
  return sanitizeSummaryHtml(stripCodeFences(raw));
}

// Highlights suggestion → one inline-HTML string per bullet. Accepts real list
// HTML, <p> blocks, or newline-separated lines (with or without inline marks).
export function normalizeHighlightsSuggestion(raw: string): string[] {
  const text = stripCodeFences(raw);
  const hasBlockTags = /<\s*(p|li|ul|ol|div|br)\b/i.test(text);
  const lines = hasBlockTags
    ? htmlToLines(text)
    : text.split(/\r?\n/).map((l) => runsToHtml(parseInlineRuns(l)));
  return lines
    .map((l) => runsToHtml(parseInlineRuns(stripListMarker(l))).trim())
    .filter((l) => parseInlineRuns(l).some((r) => r.text.trim() !== ""));
}

// Plain text of a (possibly partial, mid-stream) HTML answer for the live
// "writing…" preview: tags are dropped, block tags become line breaks.
export function streamingPreviewText(raw: string): string {
  return stripCodeFences(raw)
    .replace(/<\s*\/\s*(p|li|div)\s*>/gi, "\n")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
