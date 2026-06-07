# Spec: Rich-text formatting

## ADDED Requirements

### Requirement: Rich-text Summary

The system SHALL allow the Professional Summary to be formatted as rich text
supporting multiple paragraphs, bold, italic, underline, strikethrough, and
bullet/numbered lists, and SHALL render that formatting in the live preview, the
printed PDF, and the DOCX and PPTX exports.

#### Scenario: User formats the summary
Given the user is editing a resume version
When the user types paragraphs and applies bold, italic, underline,
strikethrough, or a bullet/numbered list in the summary editor
Then the live preview shall show the formatted summary.

#### Scenario: Formatted summary is exported
Given a resume has a formatted summary
When the user exports to PDF, DOCX, or PPTX
Then the export shall preserve the paragraphs, lists, and inline formatting.

#### Scenario: Legacy plain-text summary
Given a resume saved with a plain-text summary
When the resume is opened or rendered
Then the summary shall render as plain paragraphs without loss.

### Requirement: Rich-text Work Experience highlights

The system SHALL allow each Work Experience highlight to carry inline formatting
(bold, italic, underline, strikethrough) while remaining a single bullet, and
SHALL render that formatting in the live preview, PDF, DOCX, and PPTX exports.

#### Scenario: User formats a highlight
Given the user is editing a Work Experience entry
When the user applies bold, italic, underline, or strikethrough to text within a
highlight
Then the live preview shall show the formatted highlight as a bullet.

#### Scenario: Each line is a separate bullet
Given the user is editing highlights
When the user presses Enter
Then a new highlight bullet shall be created.

#### Scenario: Formatted highlights are exported
Given a Work Experience entry has formatted highlights
When the user exports to PDF, DOCX, or PPTX
Then each highlight shall render as a bullet with its inline formatting.

### Requirement: Sanitized rich-text storage

The system SHALL store rich text using a constrained set of tags (paragraphs,
lists, bold, italic, underline, strikethrough) and SHALL strip scripts and any
unrecognized tags.

#### Scenario: Unsafe input is sanitized
Given rich-text input that contains a script or unsupported tag
When the value is saved
Then the stored value shall exclude the script and unsupported tags while
keeping the recognized formatting and text.
