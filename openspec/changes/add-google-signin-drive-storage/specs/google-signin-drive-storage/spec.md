# Spec: Google Sign-in and Google Drive Storage

## ADDED Requirements

### Requirement: Google sign-in page

The system SHALL provide a sign-in page where users can authenticate using Google.

#### Scenario: User opens sign-in page
Given the user is not signed in
When the user opens `/signin`
Then the system shall show a "Sign in with Google" button.

#### Scenario: User signs in with Google
Given the user is on `/signin`
When the user clicks "Sign in with Google" and completes authentication
Then the system shall redirect the user to the dashboard.

### Requirement: Protected ResumeFlow pages

The system SHALL protect ResumeFlow application pages from unauthenticated access.

#### Scenario: Unauthenticated user opens dashboard
Given the user is not signed in
When the user opens `/`
Then the system shall redirect the user to `/signin`.

#### Scenario: Signed-in user opens dashboard
Given the user is signed in
When the user opens `/`
Then the system shall show the ResumeFlow dashboard.

### Requirement: Google Drive JSON storage

The system SHALL save ResumeFlow JSON data to the signed-in user's Google Drive appDataFolder.

#### Scenario: User saves resume
Given the user is signed in
When the user creates or updates a resume
Then the system shall save the resume data to `resumeflow-resumes.json` in Google Drive appDataFolder.

#### Scenario: User reloads app
Given the user has existing ResumeFlow data in Google Drive
When the user signs in and opens the app
Then the system shall load the resume and application data from Google Drive.

#### Scenario: Drive JSON file does not exist
Given the user is signed in
And the required ResumeFlow JSON file does not exist in Google Drive
When the app tries to read the file
Then the system shall create the file with an empty array.

### Requirement: Profile photo storage in Google Drive

The system SHALL store profile photos in the signed-in user's Google Drive appDataFolder.

#### Scenario: User uploads profile photo
Given the user is signed in and editing a resume
When the user uploads a profile photo
Then the system shall upload the photo to Google Drive appDataFolder.

#### Scenario: Profile photo metadata is saved
Given the photo upload succeeded
When the resume is saved
Then the resume JSON shall store the photo driveFileId, fileName, mimeType, and createdAt.

#### Scenario: CTS template displays Drive photo
Given a resume has profile photo metadata
When the user previews the CTS template
Then the CTS template shall display the profile photo.

### Requirement: Secure token handling

The system SHALL keep Google OAuth tokens server-side.

#### Scenario: Client requests resume data
Given the user is signed in
When the client requests resume data
Then the server shall use the Google access token internally and shall not expose the token to the client.

### Requirement: Sign out

The system SHALL allow users to sign out.

#### Scenario: User signs out
Given the user is signed in
When the user clicks Sign out
Then the system shall end the session and return the user to `/signin`.
