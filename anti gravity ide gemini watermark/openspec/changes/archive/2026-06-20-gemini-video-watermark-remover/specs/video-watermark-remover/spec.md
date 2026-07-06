## ADDED Requirements

### Requirement: Local Video Demuxing and Decoding
The system SHALL demux input MP4 files locally in the browser using `mp4box.all.min.js` and decode the video track frame-by-frame using the browser's WebCodecs API (`VideoDecoder`).

#### Scenario: Successful video decoding
- **WHEN** a valid MP4 file is selected and decoding starts
- **THEN** the system SHALL extract metadata and decode every video frame into a `VideoFrame` object sequentially

### Requirement: Dynamic Watermark Detection
The system SHALL compute the Pearson correlation coefficient between the first 5 frames of the video and a preloaded watermark alpha template. It SHALL select the corner candidate coordinate list with the highest correlation as the target watermark location.

#### Scenario: Watermark coordinates identified
- **WHEN** the correlation is evaluated on the first 5 frames of a 1280x720 video
- **THEN** the system SHALL choose the offset candidate (e.g., U = [144, 120, 128, 72]) that yields the highest Pearson correlation score

### Requirement: Pixel-Level Unblending
The system SHALL restore background pixels by solving the alpha-blending equation: `Background = (Original - WatermarkColor * Alpha) / (1 - Alpha)`. If the alpha is near 1, it SHALL apply neighbor-based average blending to hide edge artifacts.

#### Scenario: Watermark pixels cleaned
- **WHEN** a frame with a semi-transparent watermark logo is processed
- **THEN** the system SHALL restore the pixels within the detected watermark bounding box to their original background values and apply edge smoothing

### Requirement: Video Encoding and Muxing
The system SHALL encode processed frames into an H.264 video stream using WebCodecs (`VideoEncoder`) and mux the H.264 stream and the original audio track back into a valid MP4 container using `mp4-muxer.min.js`.

#### Scenario: Cleaned MP4 file generation
- **WHEN** all video frames have been processed and encoded, and audio packets are copied
- **THEN** the system SHALL finalize the muxer and output a downloadable Blob of type `video/mp4`
