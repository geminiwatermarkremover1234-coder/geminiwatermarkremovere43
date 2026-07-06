## 1. Video Processing & Quality Improvements

- [x] 1.1 Update `targetBitrate` formula in `processor.js` to increase the minimum to 8 Mbps and target up to 40 Mbps.
- [x] 1.2 Add `latencyMode: "quality"` to `VideoEncoder` config in `processor.js`.
- [x] 1.3 Enable `edgeCleanup` for all watermarks in `processor.js` by setting `ceiling = 0.99`, dilation `radius = 3`, and `strength = 0.8`.

## 2. UI & Download Logic Improvements

- [x] 2.1 Update `triggerDownload` in `app.js` to append the temporary `link` to `document.body` before calling `.click()` and remove it immediately after.

## 3. Verification & Testing

- [x] 3.1 Test the watermark removal on `WhatsApp Video 2026-06-18 at 6.32.59 PM.mp4` to verify high-fidelity video quality and clean watermark boundaries.
- [x] 3.2 Verify that downloading the processed video works perfectly in MP4 format.
