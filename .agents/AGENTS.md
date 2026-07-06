## Rules for Watermark Removal and Pixel-Level Unblending

When implementing or refining watermark removal algorithms, adhere to these mathematical and structural invariants:

1. **Perfect Unblending Color**: For grayscale watermark templates representing white logos, always use `255` as the template color in both the scoring and unblending formulas. Do not use lower color limits (e.g. 250), as under-subtraction leaves transparent outline artifacts.
2. **Dynamic Smoothing Map**: Never apply uniform smoothing/inpainting. Compute a dynamic strength map where:
   - Underflow pixels (restored value < 0) get a strength of `1.0` (full neighbor replacement).
   - High-alpha template pixels scale their smoothing strength up proportionally to alpha to suppress amplified compression noise.
   - Outer dilated boundary pixels get a reduced strength (e.g. 70% of base) for soft blending.
3. **Padded Box Boundary-Safe Gathering**: Ensure neighbor-averaging loops gather neighbors outside the padded bounding box when near the boundaries, provided they are valid non-mask pixels inside the image canvas.
