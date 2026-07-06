## MODIFIED Requirements

### Requirement: Dynamic Watermark Detection
The system SHALL compute the Pearson correlation coefficient between the first 5 frames of the video and the preloaded watermark template for the selected mode (Gemini Omni or Google Veo) and resolution. It SHALL select the corner candidate coordinate list with the highest correlation as the target watermark location.

#### Scenario: Watermark coordinates identified
- **WHEN** the correlation is evaluated on the first 5 frames of a 1280x720 video in Google Veo mode
- **THEN** the system SHALL choose the offset candidate (e.g., U = [88]) that yields the highest Pearson correlation score using the Veo 720p template

### Requirement: Pixel-Level Unblending
The system SHALL restore background pixels by solving the alpha-blending equation: `Background = (Original - WatermarkColor * Alpha) / (1 - Alpha)`. It SHALL apply neighbor-based average blending to hide edge artifacts using configuration specific to the selected mode (e.g., a dilation radius of 3 and strength of 0.68 for Google Veo).

#### Scenario: Watermark pixels cleaned
- **WHEN** a frame with a semi-transparent watermark logo is processed in Google Veo mode
- **THEN** the system SHALL restore the pixels within the detected watermark bounding box to their original background values and apply edge smoothing with a strength of 0.68 and radius of 3
