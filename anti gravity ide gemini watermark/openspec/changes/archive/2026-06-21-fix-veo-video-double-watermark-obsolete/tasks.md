## 1. UI Integration

- [ ] 1.1 Add UI mode toggle buttons to switch between Gemini Omni and Google Veo Video Cleaners.
- [ ] 1.2 Update dropzone and upload event listeners to pass the selected mode down to the processor.

## 2. Core Processor Enhancements

- [ ] 2.1 Update `loadWatermarkMap` in `processor.js` to accept width and height dynamically.
- [ ] 2.2 Define Veo watermark metadata (1080p and 720p template paths, bounding box coordinates, and custom unblending parameters).
- [ ] 2.3 Update template correlation matching in `processor.js` to support Veo specific candidates.
- [ ] 2.4 Update unblending logic parameters dynamically based on the selected mode (Gemini vs. Veo).

## 3. Verification

- [ ] 3.1 Verify clean removal of Google Veo and Gemini Omni watermarks using local test video files.
- [ ] 3.2 Check for any double watermarks or sparkles left behind on cleaned video files.
