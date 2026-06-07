# Spec: ResumeFlow MVP

## ADDED Requirements

### Requirement: Dashboard overview

The system SHALL display a dashboard showing resume and application overview.

#### Scenario: User opens dashboard
Given resume and application data exists
When the user opens the dashboard
Then the system shall show total resume versions, total applications, applications by status, and recent applications.

### Requirement: Resume builder

The system SHALL allow users to create resumes from structured JSON data.

#### Scenario: User edits resume data
Given the user is on the resume builder page
When the user edits resume form fields
Then the resume preview shall update using the same resume data.

### Requirement: Resume template selection

The system SHALL allow users to select different resume templates for the same resume JSON data.

#### Scenario: User selects a resume template
Given the user is editing a resume version
When the user selects Modern, Classic, Minimal, Custom, or ATS Corporate Style template
Then the live preview shall update using the selected template.

#### Scenario: User saves selected template
Given the user selected a resume template
When the user saves the resume version
Then the selected template shall be stored in resumes.json.

#### Scenario: User prints resume
Given a resume version has a selected template
When the user prints or downloads the resume
Then the system shall use the selected template layout.

### Requirement: Resume version management

The system SHALL allow users to create, edit, duplicate, preview, and print resume versions.

#### Scenario: User creates a resume version
Given the user opens the new resume page
When the user enters resume details and saves
Then the system shall store the resume version in resumes.json.

#### Scenario: User duplicates a resume version
Given an existing resume version exists
When the user selects duplicate
Then the system shall create a new resume version using the existing data with a new ID and version number.

### Requirement: Job application tracking

The system SHALL allow users to create and manage job applications.

#### Scenario: User creates job application
Given at least one resume version exists
When the user adds company, job title, job ID, job description, and selected resume version
Then the system shall store the job application in applications.json.

#### Scenario: User updates application status
Given a job application exists
When the user changes the status
Then the system shall update the application and record a status history entry.

### Requirement: Application notes

The system SHALL allow users to add notes to job applications.

#### Scenario: User adds note
Given a job application exists
When the user adds a note with type and text
Then the system shall store the note in notes.json linked to the application.

### Requirement: Interview Q&A

The system SHALL allow users to create and manage interview Q&A items for each job application.

#### Scenario: User adds Q&A item
Given a job application exists
When the user adds a question, answer, category, and difficulty
Then the system shall store the Q&A item in qna.json.

#### Scenario: User marks question as practiced
Given a Q&A item exists
When the user marks it as practiced
Then the system shall update the practiced value.

### Requirement: AI placeholder actions

The system SHALL show placeholder AI action buttons on the application detail page.

#### Scenario: User clicks Generate Interview Q&A
Given a job application has a resume version and job description
When the user clicks Generate Interview Q&A
Then the system shall generate sample Q&A items without calling an external AI API.

### Requirement: JSON persistence

The system SHALL persist MVP data in JSON files.

#### Scenario: JSON file does not exist
Given a required JSON file is missing
When the app tries to read or write data
Then the system shall create the file automatically with an empty array.

### Requirement: Clean UI

The system SHALL provide a clean and uncluttered interface.

#### Scenario: User navigates application
Given the user opens ResumeFlow
When the user moves between dashboard, resumes, and applications
Then the navigation shall be clear and the UI shall remain simple and responsive.

### Requirement: ATS Corporate Style template Areas of Expertise

The ATS Corporate Style resume template SHALL display an Areas of Expertise section using resume JSON data.

#### Scenario: User has areas of expertise
Given a resume version has areasOfExpertise values
When the user selects the ATS Corporate Style template
Then the ATS Corporate Style preview shall display an Areas of Expertise section.

#### Scenario: Areas of Expertise has many items
Given a resume version has multiple areasOfExpertise values
When the ATS Corporate Style template is rendered
Then the system shall display the items as a clean two-column bullet list.

#### Scenario: User has no areas of expertise
Given a resume version has no areasOfExpertise values
When the ATS Corporate Style template is rendered
Then the system shall hide the Areas of Expertise section.

### Requirement: Profile photo support

The system SHALL allow users to add an optional profile photo to a resume version.

#### Scenario: User uploads profile photo
Given the user is editing a resume version
When the user selects a profile photo
Then the system shall show a preview of the photo in the resume form.

#### Scenario: User saves profile photo
Given the user selected a profile photo
When the user saves the resume version
Then the system shall store the photo data in resumes.json.

#### Scenario: ATS Corporate Style template displays profile photo
Given a resume version has a profilePhoto value
When the user selects the ATS Corporate Style template
Then the ATS Corporate Style template shall display the profile photo in the header area.

#### Scenario: User removes profile photo
Given a resume version has a profile photo
When the user clicks remove photo
Then the profile photo shall be removed from the resume version.

#### Scenario: Resume has no profile photo
Given a resume version has no profilePhoto value
When the resume template is rendered
Then the system shall hide the photo area or show a clean placeholder.

### Requirement: Template font and color customization

The system SHALL allow users to customize font and colors for resume templates.

#### Scenario: User changes font
Given the user is editing a resume version
When the user selects a different font
Then the live resume preview shall update using the selected font.

#### Scenario: User changes primary color
Given the user is editing a resume version
When the user selects a different primary color
Then the resume headings, name, important labels, and section lines shall update using the selected color.

#### Scenario: User saves template style
Given the user changed font or colors
When the user saves the resume version
Then the selected style settings shall be stored in resumes.json.

#### Scenario: User reloads resume version
Given a resume version has saved template style settings
When the user opens the resume again
Then the saved font and colors shall be loaded and applied to the preview.

### Requirement: Resume export formats

The system SHALL allow users to export resumes in PDF, DOCX, and PPTX formats.

#### Scenario: User downloads PDF
Given the user is previewing a resume
When the user clicks Download PDF
Then the system shall export the resume using the selected template and style settings as a PDF.

#### Scenario: User downloads DOCX
Given the user is previewing a resume
When the user clicks Download DOCX
Then the system shall generate an editable Word document using the selected resume data, template, and style settings.

#### Scenario: User downloads PPTX
Given the user is previewing a resume
When the user clicks Download PPTX
Then the system shall generate a PowerPoint presentation using the selected resume data, template, and style settings.

#### Scenario: Export works for all templates
Given the user selected Modern, Classic, Minimal, Custom, or ATS Corporate Style template
When the user exports the resume
Then the system shall support PDF, DOCX, and PPTX export for the selected template.

### Requirement: Collapsible resume form cards

The system SHALL allow resume builder form cards to be collapsed and expanded.

#### Scenario: User collapses a form card
Given the user is editing a resume
When the user clicks collapse on a form card
Then the card content shall be hidden and the card header shall remain visible.

#### Scenario: User expands a form card
Given a form card is collapsed
When the user clicks expand
Then the card content shall be shown again.

#### Scenario: User saves collapsed card state
Given the user collapsed or expanded resume form cards
When the user saves the resume version
Then the collapsed state shall be stored in resumes.json.

### Requirement: Rearrangeable resume form cards

The system SHALL allow users to rearrange resume builder form cards.

#### Scenario: User rearranges form cards
Given the user is editing a resume
When the user moves a form card up or down
Then the builder UI shall reorder the cards.

#### Scenario: User saves form card order
Given the user rearranged form cards
When the user saves the resume version
Then the form card order shall be stored in resumes.json.

#### Scenario: User reloads resume
Given a resume version has saved form card order
When the user opens the resume again
Then the builder shall display the form cards in the saved order.

### Requirement: Areas of Expertise item entry

The system SHALL allow users to add Areas of Expertise items one by one.

#### Scenario: User adds expertise item
Given the user is editing the Areas of Expertise card
When the user enters one expertise item and clicks add
Then the item shall be added to the Areas of Expertise list.

#### Scenario: User removes expertise item
Given the Areas of Expertise list contains items
When the user removes one item
Then the item shall be removed from the list.

#### Scenario: User reorders expertise items
Given the Areas of Expertise list contains multiple items
When the user moves an item up or down
Then the item order shall be updated.

### Requirement: Areas of Expertise bullet style

The system SHALL allow users to choose bullet style for Areas of Expertise.

#### Scenario: User selects bullet style
Given the user is editing Areas of Expertise
When the user selects bullet, dash, checkmark, arrow, or none
Then the preview shall render Areas of Expertise using the selected style.

#### Scenario: User saves bullet style
Given the user selected an Areas of Expertise bullet style
When the user saves the resume
Then the selected bullet style shall be stored in resumes.json.

### Requirement: Areas of Expertise two-column layout

The system SHALL render Areas of Expertise in a balanced two-column layout.

#### Scenario: Even number of expertise items
Given the resume has 10 Areas of Expertise items
When the preview is rendered
Then the system shall show 5 items in the left column and 5 items in the right column.

#### Scenario: Odd number of expertise items
Given the resume has 9 Areas of Expertise items
When the preview is rendered
Then the system shall show 5 items in the left column and 4 items in the right column.

#### Scenario: Export Areas of Expertise
Given the resume has Areas of Expertise items and selected bullet style
When the user exports PDF, DOCX, or PPTX
Then the exported document shall preserve the two-column layout and bullet style as much as technically possible.

### Requirement: Editable resume section labels

The system SHALL allow users to rename resume section labels per resume version.

#### Scenario: User renames Technical Skills
Given the user is editing a resume
When the user changes the section label from "Technical Skills" to "Tech Stack"
Then the builder card and live preview shall show "Tech Stack".

#### Scenario: User saves custom section label
Given the user renamed a section
When the user saves the resume version
Then the custom section label shall be stored in resumes.json.

#### Scenario: User reloads resume with custom label
Given a resume version has a saved custom section label
When the user opens the resume again
Then the builder and preview shall show the saved custom label.

#### Scenario: User exports resume with custom labels
Given a resume version has custom section labels
When the user exports PDF, DOCX, or PPTX
Then the exported document shall use the custom section labels.

#### Scenario: User resets section label
Given a section has a custom label
When the user clicks reset to default
Then the section label shall return to its default title.
