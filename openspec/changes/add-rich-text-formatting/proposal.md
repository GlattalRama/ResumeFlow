# Proposal: Rich-text formatting for Summary and Highlights

## Summary

Let users format the Professional Summary and each Work Experience highlight
with rich text — paragraphs, bold, italic, underline, strikethrough, and (for
the Summary) bullet/numbered lists — and carry that formatting through the live
preview, PDF, DOCX, and PPTX exports.

## Problem

The Summary was a plain-text textarea and each highlight was a plain string, so
users could not emphasize key phrases (e.g. bold a metric) or structure the
summary into paragraphs/lists. Resumes read flat and users asked for basic
formatting.

## Goals

- A small rich-text editor for the Summary with: paragraphs, bold, italic,
  underline, strikethrough, bullet list, numbered list.
- Inline rich text for each Work Experience highlight: bold, italic, underline,
  strikethrough (each highlight remains a single bullet).
- Formatting renders consistently in the builder preview, the printed PDF, and
  the DOCX and PPTX exports.
- Backward compatible: existing plain-text summaries and highlights keep working
  (rendered as plain paragraphs / bullets).

## Non-goals

- No new storage fields. The Summary stays `basics.summary` (a constrained-HTML
  string); each highlight stays a string in `highlights[]` (now inline HTML).
- No links, headings, font-size, color, code, tables, or other GitHub-style
  controls — they don't translate to a resume document.
- No rich text for other fields in this change.

## Success Criteria

- The Summary editor offers the listed controls; Enter creates a new paragraph.
- The Highlights editor offers bold/italic/underline/strikethrough; Enter adds a
  new bullet.
- Formatting appears identically in preview, PDF, DOCX, and PPTX.
- Stored content is sanitized to a constrained tag set (no scripts/unknown tags).
- Existing plain-text content renders unchanged.
