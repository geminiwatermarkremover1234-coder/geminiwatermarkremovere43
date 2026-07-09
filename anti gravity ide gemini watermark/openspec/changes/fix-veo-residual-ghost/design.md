## Context

Veo cleaning unblends with `p = alpha * baseStrength * opacity`. Originally `opacity` was snapped to a discrete candidate (`OPACITY_CANDIDATES = [1.0, 0.62]`) locked once from the first ~5 frames. Testing at 10-12x zoom (chrome-devtools, veo.mp4 + veo test.mp4) showed three distinct residuals: a dark imprint from opacity snapping, bright/colored imprints on frames far from the detection window (per-frame ground-truth sweep found optimal opacity varying 0.62 → 0.80 across one video, and chroma ghosts invisible to luma metrics), and mottling from unblend noise amplification (divide by `1 - p ≈ 0.38`).

## Goals / Non-Goals

**Goals:**
- No legible "Veo" imprint at 10x zoom on any frame; residual-vs-template correlation ≲ 0.15.
- Keep changes confined to the Veo video path — no changes to unblend math elsewhere, mux/demux, or the Gemini path.

**Non-Goals:**
- Changing the discrete candidate list or Gemini selection behavior.
- Server-side or ML inpainting.

## Decisions

### 1. Continuous LS refinement of the locked opacity, not more discrete candidates
Adding candidates shrinks the snap gap but never closes it. `scoreOpacityCandidateRef` already computes a weighted least-squares estimate per frame (and already treats it as ground truth via its primary score term) — return it and average it across detection frames in `findBestOpacity`. Guarded to ±0.18 of the discrete winner, clamped [0.40, 1.0]; fallback is exactly the old behavior.

### 2. Per-frame, per-channel zero-residual solve (bisection), not the LS estimate per frame
The LS estimate needs a background model (`sampleBackground`) and proved noisy on busy frames — a per-frame LS attempt overcorrected (residual flipped from +10.5 to −7.9 luma at t=1). The residual-correlation function is monotonic in opacity and needs no background model: under-subtraction correlates positively with template alpha, over-subtraction negatively. Bisect for the zero (14 iterations, 29x17 region — negligible cost). Solving per channel kills chroma ghosts that a luma-only solve cannot see (H.264 chroma subsampling shifts channel balance; measured bluish "Veo" at corr_luma ≈ 0). Band [locked−0.15, locked+0.25]: ground truth needed up to +0.183 above locked. Outside the band, take the endpoint with smaller |correlation|.

### 3. Median-clamp despeckle, not Laplace smoothing
Unblending amplifies compression noise ~2.6x, visible as mottling on flat/dark backgrounds even at zero correlation. Neighbor-average (Laplace) smoothing is what caused the original blur-patch bug — rejected. A 3x3 median clamp (replace only when the pixel deviates from the median by > 6, two passes, template pixels alpha ≥ 0.08 only) suppresses speckle while leaving in-tolerance texture untouched and cannot smear edges directionally.

## Risks / Trade-offs

- **[Risk]** Per-channel solve could add chroma noise on low-contrast frames. → Mitigation: each channel is estimated from 493 samples and confined to the band; worst case equals the locked opacity behavior.
- **[Risk]** Median clamp flattens legitimate high-frequency texture inside the 29x17 mark box. → Accepted: threshold 6 keeps in-tolerance texture; the box is tiny; the alternative (visible mottling) is worse. Ceiling: if texture loss is ever reported, drop to one pass / raise threshold.
- **[Risk]** Locked opacity < 1.0 means `edgeCleanup` never triggers on Veo. → Intended: a correct sub-1.0 unblend does not need edge diffusion, and skipping it avoids the blur it introduces.

## Open Questions

None.
