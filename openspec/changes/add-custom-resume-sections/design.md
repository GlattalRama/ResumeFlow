# Design: Custom Resume Sections

## Custom Resume Sections

ResumeFlow shall allow users to create additional custom resume sections beyond the default resume sections.

Default sections include:

- Summary
- Areas of Expertise
- Work Experience
- Technical Skills
- Education
- Certifications
- Languages

Users shall be able to add as many custom sections as needed.

Examples of custom sections:

- Projects
- Publications
- Awards
- Volunteer Work
- Portfolio
- Domain Experience
- Achievements
- Training
- Client Experience
- Tools

Each custom section shall have:

- id
- title
- layoutType
- order
- visible
- collapsed
- content

Custom sections shall be part of the same resume section ordering system as default sections.

When the user moves a custom section, the order must change in:

- builder UI
- live preview
- PDF export
- DOCX export
- PPTX export

## Custom Section Layout Types

Users shall be able to choose the layout while creating or editing a custom section.

Supported custom section layout types:

```ts
type CustomSectionLayoutType =
  | "freeText"
  | "bullets"
  | "twoColumnBullets"
  | "categoryValue"
```

- `freeText` — a single rich/plain text block (e.g. a paragraph-style Summary or Domain Experience).
- `bullets` — a single column of bullet points (e.g. Achievements, Awards).
- `twoColumnBullets` — bullet points split across two columns (e.g. Tools, Technical Skills).
- `categoryValue` — label/value or category/items pairs (e.g. "Frontend: React, Next.js").

## Data Model

A custom section is modeled as part of the same section state that drives ordering for
default sections, so both kinds flow through the one `orderedVisibleSections` path used
by the live preview and every export format.

```ts
type CustomSectionLayoutType =
  | "freeText"
  | "bullets"
  | "twoColumnBullets"
  | "categoryValue"

type CustomSectionContent =
  | { kind: "freeText"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "twoColumnBullets"; left: string[]; right: string[] }
  | { kind: "categoryValue"; pairs: { category: string; value: string }[] }

type CustomSection = {
  id: string                  // stable unique id, e.g. "custom-<slug>-<n>"
  title: string               // user-editable heading
  layoutType: CustomSectionLayoutType
  order: number               // shared ordering space with default sections
  visible: boolean
  collapsed: boolean
  content: CustomSectionContent
}
```

Custom sections are stored per resume version alongside the default `ResumeSectionState`
entries, and participate in the same ordering, visibility, and collapse behavior.

## Behavior

- The builder provides an "Add Section" control that creates a new `CustomSection`
  with a user-chosen `title` and `layoutType`, appended at the end of the current order.
- Custom and default sections share one ordering space; reordering either kind updates
  `order` consistently.
- A reorder, show/hide, or rename of a custom section is reflected identically in the
  builder UI, live preview, and the PDF, DOCX, and PPTX exports via the shared
  `orderedVisibleSections` path, so formats never diverge.
- Editing a custom section's `layoutType` migrates or resets its `content` to match the
  selected layout shape.
- Custom sections can be deleted; default sections can only be hidden, not deleted.
