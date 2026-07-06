## MODIFIED Requirements

### Requirement: Pixel-Level Unblending
The system SHALL restore background pixels behind the Gemini logo by solving the alpha-blending equation: `Background = (Original - WatermarkColor * Alpha) / (1 - Alpha)`. To prevent dark outline residue on dark backgrounds (caused by H.264 compression highlights-crushing and subtraction underflow), the system SHALL perform edge cleanup and neighbor-based average blending ONLY when the calculated watermark opacity is `1.0` and the watermark template is grayscale. For colored watermarks or lower opacity configurations, the system SHALL bypass edge cleanup to preserve high-frequency background details. When edge cleanup is applied, it SHALL be restricted strictly to the watermark bounding box and SHALL use a non-destructive blend strength (e.g., strength `0.6`, radius `2`) to combine unblended values with the local average, rather than fully replacing them.

#### Scenario: Watermark pixels cleaned
- **WHEN** a frame with a semi-transparent Gemini watermark logo is processed
- **THEN** the system SHALL restore the pixels within the detected watermark bounding box to their original background values and apply dynamic edge smoothing to eliminate subtraction residue on all backgrounds
