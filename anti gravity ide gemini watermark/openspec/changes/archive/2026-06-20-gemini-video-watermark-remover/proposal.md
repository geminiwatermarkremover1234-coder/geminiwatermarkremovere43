## Why

Google Gemini (and other AI models like Google Veo) insert a visible watermark logo in the corner of generated videos. For creators, presenters, and developers, this watermark can be distracting or unsuitable for specific presentations, layouts, or video pipelines. A client-side, browser-based utility that removes this logo locally on the user's device without uploading large video files to external servers solves privacy, bandwidth, and speed concerns.

## What Changes

This change introduces a complete, single-page client-side web application designed to remove the visible Gemini/Veo watermark from supported video resolutions locally.

Key features:
- **Local browser-based video processing**: Using WebCodecs (VideoDecoder/VideoEncoder) and javascript demuxer/muxer libraries (`mp4box.min.js` and `mp4-muxer.min.js`). No files are uploaded to external servers.
- **Calibrated resolution presets**: Supports exact dimensions of 1280x720, 720x1280, 1920x1080, and 1080x1920.
- **Dynamic watermark detection**: Uses Pearson correlation mapping over the first 5 frames to automatically locate the watermark coordinates in the bottom corners.
- **Pixel-level unblending algorithm**: Reverses alpha blending equations to clean the watermark region and applies dilation-based edge smoothing/blurring to hide compression artifacts.
- **Premium responsive UI**: A dark-mode, modern glassmorphic dashboard featuring drag-and-drop uploads, live original-vs-preview comparisons, progress indicators, credit management (3 free uses per day, upgrade placeholders), and a clean responsive interface.

## Capabilities

### New Capabilities
- `video-watermark-remover`: Full-featured client-side video processing system including demuxing, WebCodecs decoding, pixel-level watermark restoration math, H.264 encoding, audio track muxing, and download generation.
- `watermark-remover-ui`: A premium, visually stunning single-page user interface built with HTML, Tailwind CSS, and vanilla JS, containing dashboard stats, credit limits, upload zone, interactive previewers, and premium upgrade cards.

### Modified Capabilities
<!-- None -->

## Impact

This project is a standalone, browser-only web application.
- **External Dependencies**:
  - `mp4box.all.min.js` (for MP4 demuxing)
  - `mp4-muxer.min.js` (for MP4 muxing)
  - Tailwind CSS (via CDN) for modern UI layout and styling
  - Lucide Icons (via CDN/SVG) for rich visual cues
- **Client Requirements**: WebCodecs support (`VideoDecoder`, `VideoEncoder`) is required, which is fully supported in Chromium-based browsers (Chrome, Edge, Opera).
