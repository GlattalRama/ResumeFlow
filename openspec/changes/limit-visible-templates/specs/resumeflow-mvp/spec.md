# Spec: Template visibility

## MODIFIED Requirements

### Requirement: Resume template selection

The system SHALL allow users to select a resume template for the same resume
JSON data from the set of templates marked visible. Templates may be hidden from
the picker while remaining available to render existing resumes that use them.

#### Scenario: User selects a resume template
Given the user is editing a resume version
When the user opens the template picker
Then only visible templates shall be offered (currently ATS Corporate Style),
and selecting one shall update the live preview.

#### Scenario: New resume default template
Given the user creates a new resume version
When the builder opens
Then the default selected template shall be the first visible template
(ATS Corporate Style).

#### Scenario: Existing resume uses a hidden template
Given a resume version was saved with a template that is now hidden
When the resume is previewed, printed, or exported
Then it shall still render using that template.

#### Scenario: User saves selected template
Given the user selected a resume template
When the user saves the resume version
Then the selected template shall be stored in the resume version.

#### Scenario: User prints resume
Given a resume version has a selected template
When the user prints or downloads the resume
Then the system shall use the selected template layout.
