# Spec: Custom Resume Sections

## ADDED Requirements

### Requirement: Create custom resume sections

The system SHALL allow users to create custom resume sections beyond the default sections, with no fixed limit on the number of custom sections.

#### Scenario: User adds a custom section
Given the user is editing a resume version
When the user adds a custom section with a title and a layout type
Then the system shall create a custom section with a unique id, the chosen title and layout type, and append it to the current section order.

#### Scenario: User adds multiple custom sections
Given the user has already added one custom section
When the user adds additional custom sections
Then the system shall create each one and keep them all in the resume version.

### Requirement: Custom section layout types

The system SHALL let users choose a layout type per custom section from `freeText`, `bullets`, `twoColumnBullets`, and `categoryValue`.

#### Scenario: User selects a layout type
Given the user is creating or editing a custom section
When the user selects a layout type
Then the system shall render the section content using that layout in the builder, live preview, and all exports.

#### Scenario: User changes a layout type
Given a custom section already has content
When the user changes its layout type
Then the system shall migrate or reset the content to match the new layout shape.

### Requirement: Custom sections share section ordering

The system SHALL place custom sections in the same ordering, visibility, and collapse system as default sections.

#### Scenario: User reorders a custom section
Given a resume version has default and custom sections
When the user moves a custom section
Then the system shall update the section order consistently in the builder UI, live preview, PDF export, DOCX export, and PPTX export.

#### Scenario: User hides a custom section
Given a resume version has a visible custom section
When the user hides the custom section
Then the system shall omit it from the live preview and all exports while retaining its content.

### Requirement: Edit and delete custom sections

The system SHALL allow users to rename, edit, and delete custom sections, while default sections remain hide-only.

#### Scenario: User deletes a custom section
Given a resume version has a custom section
When the user deletes the custom section
Then the system shall remove it from the resume version and from all rendered formats.

#### Scenario: User cannot delete a default section
Given a resume version has a default section
When the user attempts to remove the default section
Then the system shall only allow hiding it, not deleting it.
