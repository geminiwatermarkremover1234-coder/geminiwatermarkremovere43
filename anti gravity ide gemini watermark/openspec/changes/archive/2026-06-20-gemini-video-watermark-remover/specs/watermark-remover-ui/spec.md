## ADDED Requirements

### Requirement: Modern Premium Dashboard UI
The interface SHALL be a single-page responsive dashboard styled with Tailwind CSS, using a dark theme with glassmorphism, smooth animations, and typography from Google Fonts.

#### Scenario: User opens the dashboard
- **WHEN** the user navigates to the application
- **THEN** the browser SHALL display a dark-mode styled dashboard with custom cards, layout grid, and header navigation

### Requirement: Drag and Drop Video Upload
The interface SHALL provide a drag-and-drop file upload zone that accepts only the supported video resolutions: 1280x720, 720x1280, 1920x1080, and 1080x1920.

#### Scenario: User uploads unsupported video resolution
- **WHEN** the user drops a video with resolution 800x600 onto the upload zone
- **THEN** the system SHALL reject the file and display an error message: "Unsupported dimensions"

#### Scenario: User uploads supported video resolution
- **WHEN** the user drops a video with resolution 1280x720 onto the upload zone
- **THEN** the system SHALL accept the file, add it to the processing queue, and show "Ready for local processing"

### Requirement: Processing and Download Workflow
The interface SHALL display a progress bar during local video rendering. Once complete, it SHALL display a side-by-side or stacked preview of the original and cleaned videos, and show a "Download MP4" button.

#### Scenario: Video is successfully cleaned
- **WHEN** processing finishes and reaches 100%
- **THEN** the interface SHALL render a video element containing the cleaned video stream and enable the "Download MP4" button

### Requirement: Local Credit Management
The system SHALL limit non-authenticated users to 3 free video conversions per day. Authenticated users SHALL get 6 free daily credits. Usage SHALL be tracked in browser `localStorage`.

#### Scenario: User consumes all guest credits
- **WHEN** a guest user processes a 3rd video in a single day
- **THEN** the dashboard SHALL display "Free mode: 0/3 daily videos left" and disable the "Remove From Selected" button, prompting them to sign in or upgrade
