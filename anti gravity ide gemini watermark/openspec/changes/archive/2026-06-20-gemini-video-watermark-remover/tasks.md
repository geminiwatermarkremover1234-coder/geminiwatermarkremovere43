## 1. Setup

- [x] 1.1 Create the directory structure: root directories for vendor libraries (`/vendor`) and watermark templates (`/watermarks`).
- [x] 1.2 Download external libraries `mp4box.all.min.js` and `mp4-muxer.min.js` and save them under the `/vendor` folder.
- [x] 1.3 Fetch/download target watermark templates `bg_48.png` and `gemini-star_paired_star_overlay.png` and place them under `/watermarks` folder.

## 2. Core Video Processing Logic

- [x] 2.1 Implement video track demuxing and frame decoding using MP4Box and browser `VideoDecoder`.
- [x] 2.2 Implement dynamic coordinate detection using Pearson correlation scoring of candidate positions over the first 5 frames.
- [x] 2.3 Implement inverse alpha blending logic on canvas ImageData to remove the watermark logo.
- [x] 2.4 Implement H.264 frame encoding using `VideoEncoder` and container muxing using `Mp4Muxer`.
- [x] 2.5 Implement audio track extraction and direct sample muxing to preserve original audio with synchronized timestamps.

## 3. User Interface and Dashboard

- [x] 3.1 Implement the responsive single-page HTML layout containing dashboard status, video preview grid, drag-and-drop upload zone, and premium cards.
- [x] 3.2 Implement custom CSS with variables, glassmorphic card effects, smooth animations, and a dark-mode theme.
- [x] 3.3 Implement frontend state management: file selection, resolution checks, local queue rendering, progress bar updating, and download actions.
- [x] 3.4 Implement local credits management in localStorage to track daily conversions, limit guests to 3, and display credit warnings.
