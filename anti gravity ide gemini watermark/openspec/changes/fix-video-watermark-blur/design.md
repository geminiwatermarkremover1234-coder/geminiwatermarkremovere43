## Context

The video watermark remover processes video frames by solving the alpha-blending equation to restore background pixels behind the semi-transparent Gemini logo. On structured backgrounds (like wood floor grain or t-shirt fabric lines), the unblending process can be highly sensitive to noise, and any subsequent Laplace edge cleanup (averaging) completely blurs out the fine details, resulting in flat, blurred patches. The reference website `geminiwatermarkremove.net` avoids this by restricting the edge cleanup to the bounding box (no padding), using a weaker blending strength (`0.6` instead of `0.8`), smaller radius (`2` instead of `3`), and disabling edge cleanup entirely for colored or lower-opacity watermarks.

## Goals / Non-Goals

**Goals:**
- Eliminate flat, blurred patches in the cleaned video output on structured backgrounds.
- Align the edge cleanup and opacity decision logic in `processor.js` with the reference website's logic.
- Ensure texture details (wood grain, cloth fibers) are preserved naturally.
- Keep execution client-side with zero performance degradation.

**Non-Goals:**
- Replacing the client-side WebCodecs/Canvas processing model with server-side processing.
- Modifying the video demuxer/muxer or audio track copying logic.

## Decisions

### 1. Constrain Edge Cleanup to the Watermark Bounding Box
Instead of padding the watermark region by 10 pixels on all sides (which blurs the surrounding background), we will restrict the mask dilation and Laplace solver strictly to the bounding box of the watermark template.
- **Why**: Surrounding pixels do not have the watermark overlaid and therefore should never be subjected to inpainting or blending, as this destroys their original fine texture.

### 2. Implement Non-Destructive Blended Inpainting
Instead of completely replacing the unblended pixel values with the neighborhood average, we will blend the two:
`data[offset + c] = Math.round(unblendedVal * (1 - strength) + avgNeighborColor * strength)`
We will set the edge cleanup configuration to match the reference site: `strength: 0.6` and `radius: 2`.
- **Why**: A strength of `0.6` preserves `40%` of the high-frequency unblended texture details, keeping the wood grain and lines visible while smoothing out the subtraction outlines.

### 3. Conditional Application of Edge Cleanup
We will only apply `edgeCleanup` when the selected watermark has an opacity of `1.0` and does not have color values (grayscale watermark `bg_48.png`). For colored watermarks (e.g. `gemini-star_paired_star_overlay.png` on 1080p videos) or lower watermark opacities, we will disable `edgeCleanup` entirely.
- **Why**: Colored watermarks and lower opacities do not suffer from the same highlight-crushing underflow issues as the 100% white grayscale watermark. The pixel unblending equation alone is sufficient, and bypassing inpainting completely preserves all background details.

### 4. Implement Margin-Based Opacity Selector Bias
We will update `findBestOpacity` to use a margin bias check. If the best-scoring candidate is `1.0` but there is a sub-1.0 candidate whose average score is within `2.5` of the best score, we will prefer the lower opacity.
- **Why**: To prevent over-subtraction artifacts on textured backgrounds, choosing a slightly lower opacity is safer and visually cleaner when scores are highly comparable.

## Risks / Trade-offs

- **[Risk]**: Bypassing edge cleanup on color or low-opacity watermarks might leave faint outlines under extreme lighting.
  - **Mitigation**: Standard pixel-level unblending is highly accurate for colored and lower-opacity watermarks because the alpha channel does not clamp or underflow as drastically. Manual visual checks in the browser will verify if outlines are completely gone.
