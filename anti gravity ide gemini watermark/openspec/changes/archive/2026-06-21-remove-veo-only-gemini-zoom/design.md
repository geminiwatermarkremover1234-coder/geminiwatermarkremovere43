## Context

The application currently has dual video cleaning support for Google Gemini Omni and Google Veo, controlled by subtabs. The requirements have changed to focus exclusively on Google Gemini Omni (video and images), removing the Veo feature entirely. We also need to add a zoom inspection mechanism to view the cleaned video in a fullscreen/maximized state.

## Goals / Non-Goals

**Goals:**
- Completely remove all Google Veo related UI tabs, navbar/footer links, text blocks, and processor logic.
- Implement a video zoom inspection button on the Cleaned Output Preview.
- Add a fullscreen glassmorphic modal overlay to play the zoomed-in cleaned video for visual inspection.
- Ensure the Gemini video watermark cleaner works perfectly (fully removes the sparkle logo on the test video).

**Non-Goals:**
- Retaining any Google Veo options or background processing paths.

## Decisions

### 1. UI Simplification and Veo Removal
We will edit `index.html` and `app.js` to:
- Remove the subtabs (`video-cleaner-tabs` element) from the Video panel.
- Remove Veo cleaner links from header navbar, footer links, and FAQs.
- Remove the `videoStudioMode` variable and simplify states to focus exclusively on Gemini video processing.

### 2. Video Zoom Inspector Implementation
- Add a zoom button (`id="zoom-video-btn"`) overlay on the `#dest-video-container` container.
- Design a zoom modal overlay (`id="zoom-modal"`) in `index.html` that will be hidden by default. When the zoom button is clicked, the modal is displayed, and the video element is cloned/moved inside the modal and played.
- Clicking the Close button in the modal or pressing Escape will hide the modal and return the video to the dashboard.
- Style the zoom button and modal in `index.css` using modern, premium glassmorphism.

### 3. Gemini Watermark Processor Tuning
- Simplify the video processor in `processor.js` to remove the `mode` parameter and Veo specific templates and coordinates.
- Retain the robust dynamic template correlation and coarse-to-fine search logic for Gemini templates (`bg_48.png` and `gemini-star_paired_star_overlay.png`).
- Ensure that unblending uses the correct opacity and edge average blending.

## Risks / Trade-offs

- **[Risk] Fullscreen performance** &rarr; The zoom modal will use standard HTML5 video elements inside a fixed overlay with hardware-accelerated transitions to ensure 60fps rendering.
