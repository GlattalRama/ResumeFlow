# Spec: Admin Analytics Dashboard

## ADDED Requirements

### Requirement: Admin role gates analytics access

The system SHALL restrict the analytics dashboard and analytics APIs to admin
users, where admin membership is determined by the `ADMIN_EMAILS` environment
variable.

#### Scenario: Admin opens the dashboard
Given the signed-in user's email is listed in `ADMIN_EMAILS`
When the user opens the analytics dashboard
Then the system shall render the dashboard.

#### Scenario: Normal user is denied
Given the signed-in user's email is not listed in `ADMIN_EMAILS`
When the user requests the analytics dashboard or an analytics API
Then the system shall deny access and respond as not-found (404).

#### Scenario: No admins configured
Given `ADMIN_EMAILS` is empty or unset
When any user requests the analytics dashboard or an analytics API
Then the system shall treat no user as an admin and deny access.

### Requirement: Track usage events as privacy-friendly counters

The system SHALL record product-usage events as aggregate counters in an
app-owned store, and SHALL NOT store resume content, job-description content,
user photos, names, emails, raw user identifiers, IP addresses, or user agents.

#### Scenario: An event increments only counters
Given a tracked action occurs (login, resume created, application created, resume exported, or AI-tailored generation)
When the system records the event
Then the system shall increment aggregate counters only, and shall not write any resume text, job-description text, photo, or free-text PII.

#### Scenario: Export event carries only a closed-enum format
Given a resume is exported
When the system records the `resume_exported` event
Then the only additional dimension stored shall be the export `format` drawn from a closed enumeration.

### Requirement: Analytics tracking fails open

The system SHALL ensure that analytics tracking never breaks a user action, and
SHALL no-op when no analytics store is configured.

#### Scenario: Store is not configured
Given no analytics store is configured
When a trackable action occurs
Then the system shall skip tracking and complete the user action normally.

#### Scenario: Store errors during tracking
Given the analytics store raises an error while recording an event
When a trackable action occurs
Then the system shall swallow the error and complete the user action normally.

### Requirement: Counts are bucketed by time period

The system SHALL maintain counts per event in day, week, month, year, and
all-time buckets, computed in UTC.

#### Scenario: One action updates every period bucket
Given a trackable action occurs at a given instant
When the system records it
Then the system shall increment the matching day, week, month, year, and all-time counters for that event.

#### Scenario: Dashboard reports counts by selected period
Given an admin is viewing the dashboard
When the admin selects a period of day, week, month, year, or all-time
Then the system shall display the count of each tracked event for that period.

### Requirement: Dashboard reports the defined usage metrics

The system SHALL report, for the selected period, the number of logins, resumes
created, job applications created, resume exports, and AI-tailored resume
generations, with exports broken down by format.

#### Scenario: Metrics are visible to the admin
Given an admin is viewing the dashboard for a selected period
When the dashboard loads
Then the system shall show counts for logins, resumes created, applications created, exports (split by format), and AI-tailored generations.

#### Scenario: Active users are estimated without storing a user list
Given login events have been recorded for a period
When the dashboard displays active users for that period
Then the system SHOULD show an approximate distinct-user count derived from a non-reversible estimate, without storing any reversible user identifier.
