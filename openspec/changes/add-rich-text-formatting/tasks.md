# Tasks: Rich-text formatting for Summary and Highlights

## 1. Core rich-text lib

- [x] Add SSR-safe parser/sanitizer (paragraph + list blocks, inline marks).
- [x] Handle legacy plain text (one paragraph/bullet per line).
- [x] Strip scripts and unknown tags (constrained tag set).
- [x] Add inline helpers (parse/serialize runs, lines <-> HTML).

## 2. Editor + renderer

- [x] Build RichTextEditor (contentEditable) with a formatting toolbar.
- [x] Toolbar: bold, italic, underline, strikethrough.
- [x] Toolbar: bullet and numbered lists (Summary only, via showLists option).
- [x] Re-sync editor when value changes externally (reorder/remove).
- [x] Add RichText (block) and InlineRichText (single-line) render components.

## 3. Wire into Summary

- [x] Replace the Summary textarea with the rich-text editor.
- [x] Render the Summary via RichText in all templates.
- [x] Render the Summary rich text in DOCX and PPTX exports.

## 4. Wire into Highlights

- [x] Replace the Highlights textarea with the rich-text editor (no lists).
- [x] Render each highlight via InlineRichText in all templates.
- [x] Render highlight rich text in DOCX and PPTX exports.

## 5. Compatibility & verification

- [x] Keep Summary as a string and highlights as string[] (no model change).
- [x] Existing plain-text content renders unchanged.
- [x] Verify build/typecheck and parser round-trip.
