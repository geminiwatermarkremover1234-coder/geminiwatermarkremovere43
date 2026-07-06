## Context

In the current client-side implementation of the watermark remover in `processor.js`, unblending is done using a fixed opacity value (optimized using average frame analysis). When a video contains a watermark on a dark background (such as a dark shirt or blackboard), the highlights of the watermark are compressed and crushed by H.264 video compression. During the pixel subtraction phase, this compression causes the subtracted template color value to exceed the compressed pixel value, resulting in underflow (negative values) which are clamped to zero. This leaves a noticeable dark/black star silhouette watermark residue. The current edge cleanup uses a fixed blend strength of 0.8 which is not strong enough to completely overwrite the underflowed pixels with their neighbors.

## Goals / Non-Goals

**Goals:**
- Eliminate dark/black outline/silhouette watermark residue on dark backgrounds.
- Dynamically detect underflowed pixels during the unblending phase.
- Propagate background colors into over-subtracted regions using dynamic smoothing strength (scaling up to 1.0) during edge cleanup.
- Keep the unblending and edge cleanup algorithms performant and running fully client-side in the browser.

**Non-Goals:**
- Completely rewriting the inpainting algorithm to use external libraries (e.g., OpenCV.js or TensorFlow.js).
- Changing the dynamic watermark coordinate detection or demuxing/muxing engine.

## Decisions

### Decision 1: Use a Dynamic Smoothing Strength Map
- **Option A (Chosen)**: During the pixel unblending step, compute the maximum channel underflow value for each pixel. Build a dynamic `smoothStrengthMap` where the smoothing strength is scaled from the base strength (e.g. 0.8) up to 1.0 proportionally to the underflow level and template alpha values.
  - *Rationale*: Allows targeted correction. Pixels that are correctly unblended remain relatively untouched (using base strength of 0.8), while underflowed or high-alpha center pixels are smoothed with up to 1.0 strength (fully replaced by neighbor values).
- **Option B**: Increase the global smoothing strength `strength` parameter to 1.0.
  - *Rationale*: While it fixes dark background silhouettes, it will excessively blur the watermark region even on bright/detailed backgrounds where unblending works perfectly.

### Decision 2: Peeling Layer Propagation in Edge Cleanup
- **Option A (Chosen)**: Use the iterative outside-in peeling layer propagation mask to smooth the marked pixels, using the dynamic strength map to control the blending of the current pixel with already smoothed neighbors.
  - *Rationale*: Ensures that the background colors from outside the watermark boundary diffuse smoothly into the center of the watermark, especially when strength is close to 1.0.

## Risks / Trade-offs

- **Risk**: High strength smoothing (1.0) acts like inpainting and might blur high-frequency background details if they pass behind the watermark.
  - *Mitigation*: Since the watermark is in the corner of the frame, detailed background motion is rare. The visual benefit of completely removing the dark watermark silhouette far outweighs any minor local blur.
