## Why

When removing the Gemini watermark from videos with dark backgrounds (e.g. dark mineral-wash clothing), H.264 video compression crushes the watermark's highlights. This causes the pixel values to fall below the mathematical unblending template subtraction threshold, leading to negative values that clamp to zero and create a visible dark outline or silhouette of the watermark.

## What Changes

- **Dynamic Smoothing Strength**: Introduce a dynamic smoothing strength map that increases the blend strength (up to 1.0) for pixels that underflow or have high template alpha values during the unblending stage.
- **Improved Edge Cleanup**: Update the edge cleanup diffusion algorithm to use the dynamic smoothing strength map instead of a fixed 0.8 strength. This will cleanly interpolate the background color over over-subtracted pixels.

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

- `video-watermark-remover`: Update the unblending and edge cleanup requirements to support dynamic neighbor-based blending strength (scaling up to 1.0) to eliminate underflow residue on dark backgrounds.

## Impact

- `processor.js`: Modify `cleanFrameWatermark` to compute a dynamic smoothing strength map and apply it in the edge cleanup phase.
