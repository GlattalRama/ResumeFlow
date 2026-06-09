# Spec: Base Resume and AI Tailoring

## ADDED Requirements

### Requirement: Designate a Base Resume via a single pointer

The system SHALL allow the user to designate exactly one resume version as the
Base Resume, identified by a single `baseResumeId` pointer stored on the settings
singleton rather than a per-version flag.

#### Scenario: User sets a Base Resume
Given the user has at least one resume version and no Base Resume is set
When the user marks a version as the Base Resume
Then the system shall store that version's id as `baseResumeId` on the settings singleton, leaving every resume version's content unchanged.

#### Scenario: User changes the Base Resume
Given a Base Resume is already set
When the user marks a different version as the Base Resume
Then the system shall overwrite `baseResumeId` with the new version's id, and the previously designated version shall revert to an ordinary version automatically.

#### Scenario: Base pointer references a deleted version
Given `baseResumeId` points at a version that no longer exists
When the system resolves the Base Resume
Then the system shall treat it as "no Base Resume set".

### Requirement: Base Resume is shown in the resume list

The system SHALL clearly indicate which resume version is the Base Resume.

#### Scenario: Base Resume badge
Given a version's id matches `baseResumeId`
When the user views the resume version list
Then the system shall show a "Base Resume" badge on that version and offer a "Set as Base Resume" action on the others.

### Requirement: Deleting the Base Resume requires confirmation

The system SHALL require a strong confirmation before deleting the Base Resume
and SHALL clear the pointer on deletion.

#### Scenario: User deletes the Base Resume
Given a version is the Base Resume
When the user attempts to delete it
Then the system shall require an explicit confirmation, and upon confirmed deletion shall remove the version and clear `baseResumeId`.

### Requirement: Generate a tailored resume from a source and a job description

The system SHALL generate a new resume version tailored to a job description
using a chosen source resume, without modifying the source.

#### Scenario: Tailoring creates a new version
Given the user selects a source resume and an application with a job description
When the user generates a tailored resume and accepts the result
Then the system shall create a new resume version whose `origin` is "tailored" and whose `sourceResumeId` is the source version's id, leaving the source version unchanged.

#### Scenario: Source and Base Resume are never overwritten
Given the source resume is the Base Resume
When the user generates a tailored resume
Then the system shall not modify the Base Resume or change `baseResumeId`.

### Requirement: Default tailoring source is the Base Resume

The system SHALL default the tailoring source to the Base Resume and SHALL allow
the user to choose another version.

#### Scenario: Base Resume is the default source
Given a Base Resume is set
When the user opens the tailoring flow
Then the system shall preselect the Base Resume as the source.

#### Scenario: User chooses a different source
Given the tailoring flow is open
When the user selects a different existing version as the source
Then the system shall use that version as the source for tailoring.

#### Scenario: No Base Resume is set
Given no Base Resume is set
When the user opens the tailoring flow
Then the system shall require the user to choose a source version before generating.

### Requirement: Tailoring is section-by-section and truth-preserving

The system SHALL tailor resumes section-by-section, rephrasing, reordering, and
selecting existing content only, and SHALL NOT introduce experience, skills,
certifications, companies, titles, dates, or metrics that are absent from the
source.

#### Scenario: Immutable facts are preserved
Given a source resume with specific company names, role titles, dates, education entries, and certifications
When the system tailors the resume
Then those immutable facts shall appear in the tailored version exactly as in the source.

#### Scenario: AI-introduced fact is rejected
Given the model produces a section containing a company, date, certification, or metric not present in the source
When the system runs its post-generation verification
Then the system shall discard that section's generated output, reuse the source content for that section, and record the section as "rejected" in the tailoring summary.

#### Scenario: Highlight count does not grow
Given a work-experience entry has N highlights in the source
When the system tailors that entry
Then the tailored entry shall have at most N highlights.

### Requirement: Tailored versions store job-context and change metadata

The system SHALL persist, on each tailored version, the source resume id and a
snapshot of the job context and section-level changes.

#### Scenario: Metadata is recorded
Given the user accepts a tailored resume generated from an application
When the new version is saved
Then the system shall store `tailoredMetadata` containing the source resume id, company, job title, job id, a snapshot of the job description at generation time, the model used, the generation timestamp, and the per-section changes.

### Requirement: Review before saving a tailored resume

The system SHALL present the tailoring result for review and SHALL only persist a
new version when the user accepts it.

#### Scenario: User reviews and accepts
Given the system has generated a tailored draft
When the user views the result
Then the system shall show a tailoring summary with section-level changes, and shall create the new version only when the user accepts.

#### Scenario: User discards the draft
Given the system has generated a tailored draft
When the user discards it
Then the system shall not create or modify any resume version.

### Requirement: Tailoring reuses the existing AI access controls

The system SHALL gate tailoring through the existing AI access layer (BYOK key or
shared app key with a per-user daily cap) and SHALL count one tailoring run as a
single unit against the daily cap.

#### Scenario: Daily cap reached on the shared key
Given the user is using the shared app key and has reached the daily cap
When the user requests a tailored resume
Then the system shall refuse with the same cap message used by other AI features and shall not generate a draft.

#### Scenario: One run counts once
Given a tailoring run makes several per-section model calls
When the run executes on the shared key
Then the system shall check and increment the daily usage exactly once for the run, not once per section.

#### Scenario: No AI key available
Given no BYOK key and no shared app key are configured
When the user requests a tailored resume
Then the system shall report that AI tailoring is unavailable and shall not create a version.
