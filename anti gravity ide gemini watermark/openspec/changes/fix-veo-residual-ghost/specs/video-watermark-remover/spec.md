## ADDED Requirements

### Requirement: Veo Per-Frame Zero-Residual Opacity
For Veo watermarks, the system SHALL solve, per frame and per color channel, for the unblend opacity whose residual has zero correlation with the template alpha (bisection over a band around the locked opacity: [locked − 0.15, locked + 0.25], within [0.40, 0.95]). The locked opacity SHALL itself be refined from the discrete candidate using the continuous least-squares estimate averaged over the detection frames (within ±0.18 of the discrete winner, clamped to [0.40, 1.0]). After unblending, the system SHALL despeckle the template region (alpha ≥ 0.08) with a 3x3 median clamp so amplified compression noise does not appear as mottling. Non-Veo watermarks SHALL continue to use discrete candidate selection unchanged.

#### Scenario: True opacity between discrete candidates
- **WHEN** a Veo video whose watermark was blended at an opacity between the discrete candidates (e.g. ~0.55) is processed
- **THEN** the cleaned corner SHALL show no legible "Veo" imprint at 10x zoom and the residual-vs-template alpha correlation SHALL stay below 0.15 in magnitude on sampled frames

#### Scenario: Blend drift on frames outside the detection window
- **WHEN** H.264 quantization shifts the effective blend strength or channel balance on frames far from the detection window
- **THEN** the per-frame per-channel solve SHALL adapt within the band and leave no bright, dark, or colored wordmark residue

#### Scenario: Unreliable estimate falls back
- **WHEN** the zero-residual solution lies outside the band (or the least-squares refinement deviates more than 0.18 from the discrete winner)
- **THEN** the system SHALL use the nearest band endpoint (or the discrete winner), matching pre-change behavior at worst
