## Context

The on-device video processing engine uses WebCodecs (`VideoDecoder`/`VideoEncoder`) and `Mp4Muxer` to remove watermarks locally. Users report:
1. Slight quality degradation on the processed video due to low H.264 bitrate limits and default latency mode.
2. The download action fails to save the file with the `.mp4` format/extension on some browsers.
3. Watermark subtraction can leave slight edge residue or bleeding artifacts around the watermark location.

## Goals / Non-Goals

**Goals:**
- Optimize H.264 WebCodecs encoding settings to preserve original video quality (high bitrate and quality mode).
- Standardize the download trigger to ensure proper file naming and extension recognition.
- Improve edge blending parameters to fully erase watermark boundaries without ghosting.

**Non-Goals:**
- Moving processing to a backend server (must remain client-side in the browser).

## Decisions

### 1. High-Fidelity Video Encoder Settings
- **Problem**: Current H.264 encoding uses a low bitrate formula and default latency settings.
- **Solution**: 
  - Increase target bitrate formula to: `Math.max(8000000, Math.min(40000000, Math.round(width * height * frameRate * 0.30)))`.
  - Set `latencyMode: "quality"` in `VideoEncoder` config to instruct the hardware encoder to use high-quality profile presets.
- **Alternative**: Lossless encoding (profile avc1.64002e with Quantizer mode) was considered but has inconsistent browser hardware acceleration support.

### 2. Standardized DOM-Compliant Download Link Triggering
- **Problem**: Calling `.click()` on detached anchor nodes is blocked or stripped of properties by some browser sandbox configurations.
- **Solution**: Append the temporary anchor tag to `document.body` before calling `.click()`, and remove it immediately after.

### 3. Aggressive Edge Smoothing Mask & Parameters
- **Problem**: Faint outlines remain around the watermark region after unblending.
- **Solution**:
  - Enable `edgeCleanup` for all watermarks (both colored and grayscale).
  - Set `ceiling = 0.99`.
  - Increase dilation mask `radius` to `3` pixels to cover sub-pixel drift and H.264 chroma subsampling bleeding.
  - Set `strength = 0.8` to smooth boundary color transitions effectively.

## Risks / Trade-offs

- **[Risk] File size increase** &rarr; Higher bitrate will produce larger output files. *Mitigation*: The maximum bitrate is capped at 40 Mbps to prevent excessive bloat.
