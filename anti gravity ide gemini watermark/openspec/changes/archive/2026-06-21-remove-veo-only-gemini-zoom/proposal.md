## Why

The website needs to focus exclusively on Google Gemini Omni video and image watermark removal, removing the Google Veo watermark remover features. Additionally, users need a way to inspect the cleaned video at full screen or zoomed-in to verify that the watermark has been completely removed without leaving leftovers or ghost artifacts.

## What Changes

- Remove all Google Veo UI elements (tabs, navigation links, text descriptions) from the dashboard, headers, footers, and FAQs.
- Remove Veo-specific processing logic from the client-side app controller.
- Implement a zoom/expand icon on the Cleaned Output Preview that opens the cleaned video in a fullscreen view or centered modal, allowing high-resolution inspection.
- Fix the Gemini Omni video watermark remover logic to ensure clean, artifact-free watermark erasure.

## Capabilities

### New Capabilities
- `video-zoom-inspector`: Zoom / Fullscreen overlay modal on the video player to closely inspect cleaned results.

### Modified Capabilities
- `watermark-remover-ui`: Modify requirements to remove Google Veo controls and descriptions, keeping only Gemini Video and Image cleaners.
- `video-watermark-remover`: Refine dynamic template detection and unblending parameters for Gemini Omni watermark removal.

## Impact

- `index.html`: Remove Veo tabs, nav links, and text; add a Zoom button/icon on the video preview container; add a zoom overlay modal.
- `index.css`: Add styles for the Zoom button, full-screen zoom modal, and transitions.
- `app.js`: Remove Veo tab listeners and state; implement the Zoom modal trigger and events.
- `processor.js`: Focus template matching and unblending solely on Gemini video watermarks.
