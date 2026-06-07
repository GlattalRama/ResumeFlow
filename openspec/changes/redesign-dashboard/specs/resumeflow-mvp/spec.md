# Spec: Dashboard

## MODIFIED Requirements

### Requirement: Dashboard overview

The system SHALL display a modern dashboard summarizing the user's resumes,
applications, and interview preparation, with quick actions and recent activity.

#### Scenario: User opens dashboard
Given resume and application data exists
When the user opens the dashboard
Then the system shall show a hero with primary actions, metric cards for resume
versions, applications, active applications, and interview prep items, an
application pipeline by status, recent applications, recent resume versions, and
recent activity.

#### Scenario: Dashboard greets the signed-in user
Given the user is signed in with a known name
When the user opens the dashboard
Then the system shall show a welcome-back message using the user's name.

#### Scenario: Dashboard shows application pipeline
Given one or more applications exist
When the user opens the dashboard
Then the system shall show the count of applications for each application status
in a visual pipeline.

#### Scenario: Dashboard shows recent applications
Given one or more applications exist
When the user opens the dashboard
Then the system shall list recent applications with company, job title, status,
the resume version used, and the last updated date.

#### Scenario: Dashboard shows recent resume versions
Given one or more resume versions exist
When the user opens the dashboard
Then the system shall list recent resume versions with version name, target
role, selected template, last updated date, and quick actions to preview, edit,
and export.

#### Scenario: Dashboard shows recent activity
Given resumes or applications exist
When the user opens the dashboard
Then the system shall show recent activity derived from creation and update
timestamps and status history, in reverse-chronological order.

#### Scenario: Dashboard shows empty states
Given the user has no resumes or no applications
When the user opens the dashboard
Then the system shall show a friendly empty state with an action button for the
missing data.
