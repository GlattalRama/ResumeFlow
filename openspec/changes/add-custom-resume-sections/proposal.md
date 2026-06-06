# Proposal: Add Custom Resume Sections

## Summary

Let users create their own resume sections (beyond the fixed default set) and choose a layout for each, fully integrated into the existing section ordering and export pipeline.

## Problem

ResumeFlow ships a fixed set of default sections (Summary, Areas of Expertise, Work Experience, Technical Skills, Education, Certifications, Languages). Users need sections that are not in this list — Projects, Publications, Awards, Volunteer Work, Portfolio, Domain Experience, Achievements, Training, Client Experience, Tools, and others — and they need control over how each section's content is laid out.

## Goals

- Allow users to add any number of custom resume sections.
- Let users pick a layout type per section: `freeText`, `bullets`, `twoColumnBullets`, `categoryValue`.
- Store custom sections per resume version with id, title, layoutType, order, visible, collapsed, content.
- Put custom sections in the same ordering space as default sections.
- Reflect reorder/show-hide/rename consistently across builder UI, live preview, PDF, DOCX, and PPTX exports.
- Allow editing and deleting custom sections.

## Non-goals

- No changes to which default sections exist.
- No new export formats.
- No AI generation of custom-section content in this change.
- No drag-and-drop redesign beyond reusing the existing ordering mechanism.

## Success Criteria

- User can add a custom section with a chosen title and layout type.
- Custom sections render correctly in all four layout types.
- Reordering a custom section updates builder UI, live preview, PDF, DOCX, and PPTX.
- Hiding/renaming a custom section behaves like a default section.
- User can delete a custom section; default sections remain hide-only.
- Existing default-section behavior and exports continue to work unchanged.
