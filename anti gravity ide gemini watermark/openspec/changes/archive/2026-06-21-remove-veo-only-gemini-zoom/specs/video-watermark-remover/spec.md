## MODIFIED Requirements

### Requirement: Dynamic Watermark Detection
The system SHALL compute the Pearson correlation coefficient between the first 5 frames of the video and a preloaded Gemini watermark alpha template. It SHALL select the corner candidate coordinate list with the highest correlation as the target watermark location.

#### Scenario: Watermark coordinates identified
- **WHEN** the correlation is evaluated on the first 5 frames of a 1280x720 Gemini video
- **THEN** the system SHALL choose the offset candidate (e.g., U = [144, 120, 128, 72]) that yields the highest Pearson correlation score

### Requirement: Pixel-Level Unblending
The system SHALL restore background pixels behind the Gemini logo by solving the alpha-blending equation: `Background = (Original - WatermarkColor * Alpha) / (1 - Alpha)`. If the alpha is near 1, it SHALL apply neighbor-based average blending to hide edge artifacts.

#### Scenario: Watermark pixels cleaned
- **WHEN** a frame with a semi-transparent Gemini watermark logo is processed
- **THEN** the system SHALL restore the pixels within the detected watermark bounding box to their original background values and apply edge smoothing
