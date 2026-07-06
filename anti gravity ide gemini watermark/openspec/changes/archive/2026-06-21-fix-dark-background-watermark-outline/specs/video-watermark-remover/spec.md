## MODIFIED Requirements

### Requirement: Pixel-Level Unblending
The system SHALL restore background pixels behind the Gemini logo by solving the alpha-blending equation: `Background = (Original - WatermarkColor * Alpha) / (1 - Alpha)`. To prevent dark outline residue on dark backgrounds (caused by H.264 compression highlights-crushing and subtraction underflow), the system SHALL dynamically adjust the neighbor-based average blending strength (scaling it up to 1.0 for pixels that underflow or have high template alpha values) using a computed dynamic smoothing strength map.

#### Scenario: Watermark pixels cleaned
- **WHEN** a frame with a semi-transparent Gemini watermark logo is processed
- **THEN** the system SHALL restore the pixels within the detected watermark bounding box to their original background values and apply dynamic edge smoothing to eliminate subtraction residue on all backgrounds
