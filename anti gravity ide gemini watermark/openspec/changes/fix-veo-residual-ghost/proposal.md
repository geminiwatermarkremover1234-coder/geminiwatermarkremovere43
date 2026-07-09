## Why

Veo video cleaning left a faint dark/colored "Veo" ghost (perceived as a slight blur patch) in the bottom-right corner. Three compounding causes: (1) opacity snapped to discrete candidates (`1.0`, `0.62`) while the true blend opacity sits between them, (2) the effective blend drifts per frame and per color channel under H.264 quantization, so one global opacity leaves bright/dark/colored residue on frames far from the detection window, and (3) unblending divides by `(1 - p) ≈ 0.38`, amplifying compression noise ~2.6x into visible mottling on flat backgrounds.

## What Changes

- Expose the continuous weighted least-squares opacity estimate (`lsEstimate`, already computed in `scoreOpacityCandidateRef` and discarded) and use it to refine the locked Veo opacity in `pickBestOpacity` (bounded to ±0.18 of the discrete winner, clamped [0.40, 1.0]).
- Add `findZeroResidualOpacity`: per-frame, per-channel bisection for the opacity whose unblend residual has zero correlation with the template alpha — no background model needed. Applied in `cleanVideoFrameWatermark` for Veo, banded [locked−0.15, locked+0.25] within [0.40, 0.95].
- Add a Veo-only despeckle pass after unblending: 3x3 median-clamp (threshold 6, two passes) restricted to template pixels (alpha ≥ 0.08), suppressing amplified H.264 noise without directional blur.
- Non-Veo (Gemini) paths unchanged.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `video-watermark-remover`: Veo opacity estimation changes from "select the best-scoring discrete opacity candidate" to "solve per frame and per channel for the zero-residual opacity, seeded by the continuous least-squares refinement of the locked opacity", plus a bounded despeckle pass over the mark region.

## Impact

- `processor.js`: `scoreOpacityCandidateRef`, `pickBestOpacity`, `findBestOpacity` (LS refinement); new `findZeroResidualOpacity`; `cleanVideoFrameWatermark` (per-channel unblend + despeckle). No changes to demux/mux, encoder, or the Gemini paths.
- Latency: bisection is ~16 correlation passes over a 29x17 region per frame — negligible.
