# Specification: Watermark Remover UI

## Purpose

To design and implement a premium, high-fidelity responsive dashboard that handles file ingestion, status reporting, usage credit validation, queue lists, and on-device processing controls.

## Requirements

### Requirement: Modern Premium Dashboard UI
The interface SHALL be a single-page responsive dashboard styled with custom CSS, using a dark theme with glassmorphic cards, smooth animations, and typography from Google Fonts, focused exclusively on Google Gemini Omni watermark removal.

#### Scenario: User opens the dashboard
- **WHEN** the user navigates to the application
- **THEN** the browser SHALL display a dark-mode styled dashboard with custom cards, layout grid, and header navigation, showing only Gemini Omni video and image cleaner options

### Requirement: Drag and Drop Video Upload
The interface SHALL provide a drag-and-drop file upload zone that accepts only the supported Gemini video resolutions: 1280x720, 720x1280, 1920x1080, 1080x1920, 848x478, and 478x848.

#### Scenario: User uploads unsupported video resolution
- **WHEN** the user drops a video with resolution 800x600 onto the upload zone
- **THEN** the system SHALL reject the file and display an error message: "Unsupported dimensions"

#### Scenario: User uploads supported video resolution
- **WHEN** the user drops a video with resolution 1280x720 onto the upload zone
- **THEN** the system SHALL accept the file, add it to the processing queue, and show "Ready for local processing"

### Requirement: Processing and Download Workflow
The interface SHALL display a progress bar during local video rendering. Once complete, it SHALL display a side-by-side or stacked preview of the original and cleaned videos, and show a "Download MP4" button and a zoom/fullscreen inspection button. The download action MUST append the temporary download link to the DOM to ensure proper format and extension recognition in all browser environments.

#### Scenario: Video is successfully cleaned
- **WHEN** processing finishes and reaches 100%
- **THEN** the interface SHALL render a video element containing the cleaned video stream, enable the "Download MP4" button, and display the zoom inspection icon button

### Requirement: Local Credit Management
The system SHALL limit non-authenticated users to 3 free video conversions per day. Authenticated users SHALL get 6 free daily credits. Usage SHALL be tracked in browser `localStorage`.

#### Scenario: User consumes all guest credits
- **WHEN** a guest user processes a 3rd video in a single day
- **THEN** the dashboard SHALL display "Free mode: 0/3 daily videos left" and disable the "Remove From Selected" button, prompting them to sign in or upgrade
