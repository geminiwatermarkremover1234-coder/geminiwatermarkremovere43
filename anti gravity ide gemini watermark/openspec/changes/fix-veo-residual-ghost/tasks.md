## 1. Expose the continuous LS opacity estimate

- [x] 1.1 Return `lsEstimate` from `scoreOpacityCandidateRef` alongside `opacity` and `score`.
- [x] 1.2 Propagate per-frame `lsEstimate` through `evaluateOpacityScores` and average it across detection frames in `findBestOpacity`.

## 2. Veo opacity refinement

- [x] 2.1 In `pickBestOpacity`, when `isVeo` and the averaged LS estimate is finite: refine locked opacity to `clamp(avgLs, 0.40, 1.0)` if `|avgLs - discreteWinner| <= 0.18`, else keep the discrete winner.
- [x] 2.2 Add `findZeroResidualOpacity` (per-channel bisection on residual-vs-template-alpha correlation) and apply per frame in `cleanVideoFrameWatermark`, banded [locked−0.15, locked+0.25] within [0.40, 0.95].
- [x] 2.3 Per-channel unblend: each channel uses its own solved opacity.
- [x] 2.4 Despeckle pass: 3x3 median clamp (threshold 6, 2 passes) on template pixels (alpha ≥ 0.08).
- [x] 2.5 Verify Gemini paths (grayscale + colored) untouched — Veo logic gated on `watermark.isVeo` / `channelOpacity`.

## 3. Verify and test in browser (chrome-devtools MCP)

- [x] 3.1 Served app on :3000, processed `veo.mp4` and `veo test.mp4` on veo.html.
- [x] 3.2 Zoom-compared original vs cleaned at t = 0.5–7.5 (10x): no legible "Veo" imprint, no blur patch. Residual correlation |corr| ≤ 0.14 on all sampled frames (was 0.49 before the fix); alpha-weighted luma delta ≤ 0.6 (was 10.5).
