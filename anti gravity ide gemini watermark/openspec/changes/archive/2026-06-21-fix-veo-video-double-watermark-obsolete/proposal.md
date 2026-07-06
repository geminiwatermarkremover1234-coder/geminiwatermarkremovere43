## Why

Veo videos currently show a "double watermark" when processed because the system hardcodes Gemini Omni templates and coordinates. When a Veo video is uploaded, the app fails to match the Veo watermark correctly, resulting in the original Veo watermark remaining visible while generating a ghost Gemini watermark overlay at default coordinates. This change introduces support for Google Veo video watermarks and dynamic template selection.

## What Changes

- Add Google Veo video watermark templates and coordinate logic to the processor.
- Implement a model/mode selection toggle in the UI so users can choose between "Gemini Omni" and "Google Veo" cleaning modes.
- Allow dynamic resolution-based template matching for both Gemini and Veo videos.
- Fix the double watermark bug by applying the correct watermark removal parameters (overlay files, locations, strength) based on selected model/mode.

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Replace <name> with kebab-case identifier (e.g., user-auth, data-export, api-rate-limiting). Each creates specs/<name>/spec.md -->

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->
- `video-watermark-remover`: Update watermark detection and pixel unblending requirements to support Google Veo templates and parameters dynamically.
- `watermark-remover-ui`: Add controls to let the user select between Gemini Omni and Veo Video watermark removal modes.

## Impact

- `processor.js`: Update `loadWatermarkMap`, template caching, and rendering math to handle Veo video overlays.
- `app.js` & `index.html`: Add cleaner selector toggles, update upload and resolution checks to support both models cleanly.
- `watermarks/`: Add `veo-1080p-overlay.png` and `veo-720p-overlay.png`.
