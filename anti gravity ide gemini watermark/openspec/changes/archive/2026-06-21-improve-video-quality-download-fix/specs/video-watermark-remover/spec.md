## MODIFIED Requirements

### Requirement: Video Encoding and Muxing
The system SHALL encode processed frames into an H.264 video stream using WebCodecs (`VideoEncoder`) with high-fidelity bitrate configurations (minimum 8 Mbps and target bitrate proportional to resolution and frame rate) and quality-focused latency mode (`quality`), then mux the stream and original audio back into a valid MP4 container.

#### Scenario: Cleaned MP4 file generation
- **WHEN** all video frames have been processed and encoded, and audio packets are copied
- **THEN** the system SHALL finalize the muxer and output a downloadable Blob of type `video/mp4`

### Requirement: Pixel-Level Unblending
The system SHALL restore background pixels behind the Gemini logo by solving the alpha-blending equation: `Background = (Original - WatermarkColor * Alpha) / (1 - Alpha)`. It SHALL apply neighbor-based average blending (with dilation radius 3 and blend strength 0.8) to all watermarks (both color and white) to completely eliminate watermark outline and edge-subtraction residue.

#### Scenario: Watermark pixels cleaned
- **WHEN** a frame with a semi-transparent Gemini watermark logo is processed
- **THEN** the system SHALL restore the pixels within the detected watermark bounding box to their original background values and apply edge smoothing
