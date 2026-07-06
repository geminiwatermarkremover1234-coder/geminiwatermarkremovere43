## Context

The current watermark removal application is hardcoded for Google Gemini Omni watermarks:
- 1080p template: `/watermarks/gemini-star_paired_star_overlay.png` (`84x84`), matched against default offsets in the bottom right corner.
- 720p template: `/watermarks/bg_48.png` (`48x48`).
When a Google Veo video is uploaded, the watermark coordinates and sizes differ, leading to:
1. Failure to match and erase the original Veo logo.
2. Drawing a "ghost" Gemini watermark overlay (double watermark) because the default candidate coordinates get selected or correlation fallback triggers drawing at Gemini offsets.

To resolve this, we will add support for Google Veo watermark profiles (templates, coordinates, dimensions) and implement a UI mode selector ("Gemini Omni" vs. "Google Veo") that configures the core processing engine dynamically.

## Goals / Non-Goals

**Goals:**
- Dynamically support Gemini Omni and Google Veo cleaning modes.
- Load the correct watermark image templates (`veo-1080p-overlay.png` and `veo-720p-overlay.png` for Veo mode) based on the user's selected mode.
- Calculate correct target watermark coordinates and sizes for Veo videos:
  - 1080p: `x = width - 128`, `y = height - 78`, template size `106x54`.
  - 720p: `x = width - 88`, `y = height - 54`, template size `86x42`.
- Apply custom edge cleanup parameters for Veo watermarks (`strength = 0.68`, `radius = 3`, `ceiling = 0.99`).
- Prevent double/ghost watermark overlays from being drawn.
- Update the UI with tab or model selector buttons to toggle between Gemini and Veo Video Cleaners.

**Non-Goals:**
- Adding a server-side processing pipeline; all processing must remain client-side using WebCodecs.
- Supporting arbitrary watermarks other than Google Gemini Omni and Google Veo.

## Decisions

### 1. Unified Video Processing Interface with Mode Parameter
We will modify the core processing function `processVideoWatermark` in `processor.js` to accept a `mode` parameter (`"gemini"` or `"veo"`):
- Rationale: A single processing entry point prevents duplicating video decoding/encoding/muxing boilerplate while keeping the template loading and coordinate offset logic clean.

### 2. Veo-Specific Watermark Overlay Sizes and Templates
- We will download the official Veo templates into the local `watermarks/` folder.
- Since Veo templates are rectangular (`106x54` for 1080p, `86x42` for 720p) instead of square (like Gemini's `84x84` and `48x48`), we will update `loadWatermarkMap` in `processor.js` to support separate width and height arguments instead of a single `size` parameter.
- Rationale: Standardizing on rectangular dimension maps makes the engine flexible for any aspect ratio templates.

### 3. Coordinate Offsets Map by Mode
We will define coordinates dynamically:
- Gemini Omni:
  - 1080p: `offsets = [222, 186]`
  - 720p: `offsets = [144, 120, 128, 72]`
- Google Veo:
  - 1080p: Target `x = width - 128`, `y = height - 78`. Clamped box size: `106x54`. Offsets list: `[128]`.
  - 720p: Target `x = width - 88`, `y = height - 54`. Clamped box size: `86x42`. Offsets list: `[88]`.
- Rationale: Providing specific coordinate candidates for each mode ensures rapid, highly accurate template correlation.

### 4. Mode Selector in UI
- We will add tab buttons/controls in `index.html` to choose between "Gemini Omni Video Cleaner" and "Google Veo Video Cleaner" (resembling the reference site's navigation).
- The selected mode will be saved in app state and passed to `processVideoWatermark`.

## Risks / Trade-offs

- **[Risk] WebCodecs Compatibility** &rarr; Keep existing WebCodecs detection and user-friendly fallback alerts.
- **[Risk] Performance Overhead of Rectangular Arrays** &rarr; Minimal impact since sizes (`106x54` &approx; 5700 pixels) are extremely small. Cache maps in memory.
