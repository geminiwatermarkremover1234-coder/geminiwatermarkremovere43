## 1. Implement Refined Opacity Matching in processor.js

- [x] 1.1 Implement margin-based bias check in `findBestOpacity` to prefer lower opacities if scores are close to `1.0`.

## 2. Refine Edge Cleanup and Blending Logic in processor.js

- [x] 2.1 Update coordinates lock/setup in `processVideoWatermark` to conditionally set `edgeCleanup = { strength: 0.6, radius: 2 }` only if calculated opacity is `>= 1.0` and `!alphaMap.colorValues`.
- [x] 2.2 Refine `cleanFrameWatermark` edge cleanup masking to restrict the dilated mask strictly to the watermark bounding box (removing the `pad = 10` logic).
- [x] 2.3 Refine Laplace-like neighbor average blending formula to blend the unblended values with the local average instead of replacing them completely.

## 3. Verify and Test in Browser

- [x] 3.1 Verify processing in the browser using the test videos.
- [x] 3.2 Zoom in and inspect the cleaned video output to confirm that structured backgrounds are clean and have no visible flat blurred patches.
