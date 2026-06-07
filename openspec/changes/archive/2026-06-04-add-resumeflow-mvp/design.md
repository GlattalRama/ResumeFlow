# Design: ResumeFlow MVP

## Technical Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- JSON file storage using fs/promises
- API routes for CRUD

## Data Files

Store data in:

- /data/resumes.json
- /data/applications.json
- /data/notes.json
- /data/qna.json
- /data/statusHistory.json
- /data/documents.json

## Pages

- / : Dashboard
- /resumes : Resume versions list
- /resumes/new : Create resume
- /resumes/[id] : Resume preview
- /resumes/[id]/edit : Edit resume
- /applications : Applications list
- /applications/new : Add application
- /applications/[id] : Application detail
- /applications/[id]/edit : Edit application
- /interview-prep/[applicationId] : Interview preparation

## Resume Builder Layout

The resume builder should use a two-panel layout:

- Left side: resume form
- Right side: live resume preview
- Bottom or side: template selector cards

The live preview should update when the user edits JSON/form data.

## Resume Templates

The system shall support multiple templates using the same JSON resume data.

Initial templates:

- Modern
- Classic
- Minimal
- Custom
- ATS Corporate Style

Each resume version must store selectedTemplate.

## Template Components

Create:

- /components/templates/ModernTemplate.tsx
- /components/templates/ClassicTemplate.tsx
- /components/templates/MinimalTemplate.tsx
- /components/templates/CustomTemplate.tsx
- /components/templates/AtsCorporateTemplate.tsx
- /components/ResumeTemplateRenderer.tsx

ResumeTemplateRenderer receives resumeData and selectedTemplate, then renders the correct template.

## ResumeVersion Type

Resume version should include:

- id
- versionName
- versionNumber
- targetRole
- selectedTemplate
- createdAt
- updatedAt
- resumeData

## Application Tracking

Each application should include:

- id
- company
- jobTitle
- jobId
- jobLink
- jobDescription
- resumeVersionUsed
- status
- appliedDate
- nextAction
- nextActionDate
- createdAt
- updatedAt

## AI Placeholders

Add placeholder buttons:

- Generate Interview Q&A
- Tailor Resume for this Job
- Generate Interview Briefing
- Generate Cover Letter
- Generate Follow-up Message

No real AI API in MVP.

## ATS Corporate Style Template Areas of Expertise

The ATS Corporate Style template must show Areas of Expertise below Summary and above Work Experience.

The resumeData object must include:

- areasOfExpertise: string[]

The ATS Corporate Style template shall display Areas of Expertise as a two-column bullet list.

If areasOfExpertise is empty, hide the section.


## Profile Photo Support

ResumeFlow shall support an optional profile photo in resume data.

The resumeData object must include:

- profilePhoto: string

The profilePhoto value can be:
- a Base64 image string for MVP
- or an uploaded local image preview handled in the browser

For the MVP, store the profile photo as a Base64 string inside resumes.json.

The resume form shall allow the user to:
- upload/select a profile photo
- preview the photo
- remove the photo

Templates may use the profile photo differently.

The ATS Corporate Style template must display the profile photo in the header area, similar to the existing ATS Corporate Style screenshot.

If no profile photo exists, the template should either:
- hide the photo area
- or show a clean placeholder


## Languages

ResumeFlow shall support a list of languages in resume data.

The resumeData object must include:

- languages: string[]

The resume form shall allow the user to enter languages, one per line.

Templates shall render a Languages section when the list is non-empty and hide
it otherwise. The DOCX and PPTX exports shall include the languages.


## Template Font and Color Customization

ResumeFlow shall allow users to customize font and colors for resume templates.

This customization is especially required for the ATS Corporate Style template, but the design should be reusable for other templates later.

Each resume version shall store template style settings.

Example:

```ts
type TemplateStyleSettings = {
  fontFamily: string
  primaryColor: string
  bodyColor: string
  mutedColor: string
  sectionLineColor: string
}
```

The resumeData object must include:

- templateStyle: TemplateStyleSettings

For the MVP, store templateStyle inside resumes.json alongside the rest of the resume version data.

The resume form shall allow the user to:
- pick a font family from a curated list
- choose primary, body, muted, and section line colors
- reset to the template defaults

Each template shall define its own default TemplateStyleSettings. If a resume version has no templateStyle, the template falls back to those defaults.

The ATS Corporate Style template must apply templateStyle to:
- fontFamily for all text
- primaryColor for the name and section headings
- bodyColor for body text
- mutedColor for secondary text (dates, locations)
- sectionLineColor for section divider lines


## Resume Export Formats

ResumeFlow shall support exporting resumes in multiple formats for all templates.

Supported export formats:

- PDF

- DOCX

- PPTX

The export should use the selected resume template and selected style settings.

### PDF Export

PDF export may use browser print or an HTML-to-PDF approach for MVP.

### DOCX Export

DOCX export shall generate an editable Word document using the selected resume JSON data.

The DOCX file should include:

- candidate name

- contact details

- summary

- areas of expertise

- work experience

- education

- certifications

- languages

- technical skills

The DOCX export should preserve:

- selected font

- selected primary color

- selected body color

- section heading style

- bullet lists

### PPTX Export

PPTX export shall generate a PowerPoint presentation version of the resume.

The PPTX export should create slides such as:

Slide 1:

- candidate name

- title

- contact details

- summary

Slide 2:

- areas of expertise

- technical skills

Slide 3 and further:

- work experience

Final slide:

- education

- certifications

- languages

The PPTX export should preserve:

- selected font

- selected primary color

- selected body color

- clean professional layout

### Export UI

Each resume preview page shall show export buttons:

- Download PDF

- Download DOCX

- Download PPTX

Export should work for all templates:

- Modern

- Classic

- Minimal

- Custom

- ATS Corporate Style


## Collapsible and Rearrangeable Resume Form Cards

ResumeFlow shall allow resume builder form cards to be collapsible and rearrangeable.

Cards such as the following should support collapse/expand:

- Template Selector
- Font & Colors
- Version
- Basics
- Summary
- Areas of Expertise
- Work Experience
- Education
- Certifications
- Languages
- Technical Skills

The user should be able to rearrange resume input cards so they can work in their preferred order.

The card order should be saved per resume version.

Example:

```ts
type ResumeFormCardState = {
  cardId: string
  title: string
  collapsed: boolean
  order: number
}

type ResumeVersionLayout = {
  versionId: string
  formCardState: ResumeFormCardState[]
  sectionState: ResumeSectionState[]
}
```

`formCardState` controls the **builder UI** (which input cards are collapsed and
in what order the user edits them). `sectionState` controls the **document
structure** (which sections appear in the rendered/exported resume and in what
order). They are stored together on the version but are independent: collapsing
an input card never hides a section from the exported document.

### Behavior

- Each card has a header with a collapse/expand toggle.
- Collapsing a card hides its body but keeps it in the layout.
- Cards can be reordered via drag-and-drop on the card header.
- The `collapsed` and `order` state persists per resume version as `ResumeVersionLayout.formCardState`.
- On load, cards render in saved `order`; new cards append at the end with a default order.


## Resume Section Ordering

ResumeFlow shall give the user full control over the document structure. The
order of resume sections is not fixed by the template — the user decides it per
resume version.

For example, one user may want **Technical Skills** directly below **Summary**,
while another wants it at the very bottom. Both layouts must be possible from the
same template.

The user shall be able to reorder document sections (and show/hide them), and the
chosen order shall be reflected everywhere the resume is rendered:

- live preview
- PDF export
- DOCX export
- PPTX export

Example:
If the user moves Technical Skills above Work Experience, then Technical Skills shall appear above Work Experience in the preview and exported documents.

ResumeVersion shall store document section order.

Example:

The section ids reuse the corresponding builder form-card ids (so card reorder
and document-section reorder map cleanly onto each other). The header
(name/title/contact) is always rendered first and is not a reorderable section.

```ts
type ResumeSectionId =
  | "summary"
  | "areas"        // Areas of Expertise
  | "experience"   // Work Experience
  | "skills"       // Technical Skills
  | "projects"
  | "education"
  | "certifications"
  | "languages"

type ResumeSectionState = {
  sectionId: ResumeSectionId
  defaultTitle: string   // the template's built-in section name
  customTitle?: string   // user-renamed label; falls back to defaultTitle when unset
  collapsed: boolean
  order: number
  visible: boolean
}
```

The canonical default order + a `resolveSectionState()` merge helper (mirroring
`resolveFormCardState`) live in `lib/constants.ts`. A single
`orderedVisibleSections(data, sectionState)` helper there returns the section
ids to render — in the saved order, filtered to visible and non-empty sections.
The preview, PDF, DOCX, and PPTX paths all consume this one list, so they cannot
diverge.

### Behavior

- Sections render in ascending `order`. The user reorders them via drag-and-drop;
  the new `order` persists on `ResumeVersionLayout.sectionState`.
- `visible: false` removes the section from the preview and from every export
  (PDF, DOCX, PPTX) without deleting the underlying resume data, so it can be
  toggled back on later.
- A section with no content (e.g. empty `languages`) is hidden automatically even
  when `visible: true`.
- The same ordered, filtered section list drives the preview and all three export
  formats, so they never diverge.
- Each template defines a default `sectionState` (default order + visibility). If
  a version has no saved `sectionState`, it falls back to the template default.
- On load, any section missing from saved state (e.g. a newly added section type)
  appends at the end with a sensible default order and `visible: true`.


## Editable Resume Section Labels

ResumeFlow shall allow users to edit resume section names.

For example:

- Technical Skills can be renamed to Tech Stack
- Work Experience can be renamed to Professional Experience
- Areas of Expertise can be renamed to Core Strengths
- Summary can be renamed to Profile

Section labels must be saved per resume version.

ResumeVersion shall store section state with editable labels. This is the same
`ResumeSectionState` defined under [Resume Section Ordering](#resume-section-ordering)
above — labels live on that one type, they are not a separate structure:

```ts
type ResumeSectionState = {
  sectionId: ResumeSectionId
  defaultTitle: string   // the template's built-in section name
  customTitle?: string   // user-renamed label; falls back to defaultTitle when unset
  collapsed: boolean
  order: number
  visible: boolean
}
```

### Behavior

- The rendered heading for a section is `customTitle ?? defaultTitle`.
- Each section header in the builder shows an editable label control; saving a
  new value sets `customTitle` and persists it on
  `ResumeVersionLayout.sectionState` per resume version.
- Clearing the custom label (or a "reset" action) removes `customTitle` so the
  section falls back to `defaultTitle`.
- `defaultTitle` is supplied by the template's default `sectionState` and is not
  user-editable; only `customTitle` changes.
- The resolved label (`customTitle ?? defaultTitle`) is used everywhere the
  section heading appears: live preview, PDF, DOCX, and PPTX exports — via the
  same `orderedVisibleSections` path, so headings never diverge across formats.
