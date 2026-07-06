# Specification: Video Zoom Inspector

## Purpose

To design and implement an interactive video zoom inspector overlay that allows users to expand the cleaned video output in a fullscreen glassmorphic modal for visual quality inspection and watermark residue verification.

## Requirements

### Requirement: Full-Screen Zoom Inspection
The system SHALL provide a zoom/maximize button overlay on the cleaned video container that opens the video in a full-screen, high-resolution modal view to allow detailed visual inspection.

#### Scenario: User clicks zoom icon to open full-screen modal
- **WHEN** the user clicks the zoom/expand icon button on the cleaned video preview
- **THEN** the system SHALL display a full-screen glassmorphic modal containing the playing video and a prominent Close button

#### Scenario: User closes zoom modal
- **WHEN** the user clicks the Close button in the zoom modal
- **THEN** the system SHALL close the modal and return the user to the standard dashboard view
