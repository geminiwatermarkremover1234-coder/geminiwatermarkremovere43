## Why

The current watermark removal logic in `processor.js` applies aggressive edge cleanup and Laplace-like neighbor average blending with a 10px padding on all videos. This results in flat, blurred "ghost patch" artifacts on structured backgrounds (such as wood floor grain or fabric patterns). We need to align our implementation with the reference website `geminiwatermarkremove.net` to preserve high-frequency background details while cleanly removing the watermark logo and outlines.

## What Changes

- Refine the `cleanFrameWatermark` function in `processor.js` to match the reference site's edge cleanup behavior:
  - Restrict the edge cleanup mask strictly to the watermark bounding box (removing the 10px padding).
  - Use a smaller radius (`radius: 2`) and lower blend strength (`strength: 0.6`) for the Laplace neighbor average blending.
  - Correctly blend the unblended frame values with the neighbor average values rather than completely replacing them.
  - Enable `edgeCleanup` only for white/grayscale watermarks with `opacity >= 1.0`. Disable it for colored watermarks and lower opacity levels to prevent unnecessary blurring.
- Update `OPACITY_CANDIDATES` to include additional candidates (`0.50`, etc.) to find the mathematically optimal opacity for watermarks.
- Implement the close-margin bias check in opacity selection to prefer lower opacities if their scores are close to `1.0`, ensuring texture preservation.

## Capabilities

### New Capabilities
<!-- None needed as this is a refinement of existing capabilities -->

### Modified Capabilities
- `video-watermark-remover`: Update the pixel-level unblending and edge cleanup requirements to prioritize preserving background texture details (such as wood grain and fabric lines) on structured backgrounds, restricting the edge cleanup to white watermarks with high opacity and using a non-destructive blended local average.

## Impact

- `processor.js`: Primary changes to watermark opacity matching, edge cleanup masking, and blending logic.
- Processing latency: Should remain extremely low and client-side compliant since we are reducing the masked pixel count for edge cleanup (no 10px padding).
