# Product Requirements Document (PRD)

## 1. Product Overview

The **Gemini Omni Video Watermark Remover** is a browser-based, client-side web application designed to remove visible corner logo watermarks from generated videos (e.g. from Google Gemini Omni models or Google Veo) locally on the user's device. 

Unlike traditional cloud-based video editors, the product executes H.264 video decoding, pixel-level unblending, and MP4 container muxing entirely on-device, preserving privacy, eliminating server-side bandwidth bills, and providing instant results.

---

## 2. Target Audience & Use Cases

### 2.1 Target Audience
- **Content Creators**: Presenting generated clips in social media portfolios, reels, and custom compilations.
- **Developers & Presenters**: Incorporating AI video demos into slides, software presentations, and product showcases.
- **Privacy-Conscious Editors**: Users who prefer not to upload large source videos to cloud platforms.

### 2.2 Key Use Cases
- Removing the semi-transparent "spark" watermark from Gemini Omni videos.
- Cleaning the corner logos on both landscape (16:9) and portrait (9:16) video clips.
- Quick previewing and downloading of H.264 MP4 outputs without registering or creating an account.

---

## 3. Product Features & Requirements

### 3.1 Functional Requirements

#### 3.1.1 Local Video Ingestion
- The system MUST accept video files in MP4 format.
- The system MUST inspect the metadata dimensions of selected files and enforce supported resolutions:
  - `1280 x 720` (720p Landscape)
  - `720 x 1280` (720p Portrait)
  - `1920 x 1080` (1080p Landscape - Experimental)
  - `1080 x 1920` (1080p Portrait - Experimental)
- If a file's dimensions are unsupported, the system MUST show a descriptive warning and reject the file.

#### 3.1.2 Dynamic Watermark Recognition
- The system SHALL compute the Pearson correlation coefficient between the first 5 frames of the video and a preloaded watermark alpha template.
- The corner candidate with the highest correlation coefficient SHALL be chosen.

#### 3.1.3 Pixel Erasure Engine (Inverse Blending)
- The system MUST apply inverse alpha blending to restore background pixels:
  $$B = \frac{O - W_c \cdot p}{1 - p}$$
  Where $B$ is the restored background, $O$ is the original blended pixel, $W_c$ is the watermark template pixel color, and $p$ is the watermark template alpha value.
- The system SHALL apply edge dilation and neighboring-average smoothing to hide compression blockiness on watermark boundaries.

#### 3.1.4 Video Muxing & Encoding
- The system MUST decode frames using browser WebCodecs `VideoDecoder` and encode processed frames using `VideoEncoder` (H.264 profile).
- The system MUST demux and copy the source audio track samples (AAC) directly to the output container to preserve original audio sync.

#### 3.1.5 Credit System (Local Storage)
- Guest users SHALL be limited to 3 free video conversions per day.
- Signed-in (mocked) users SHALL be allowed 6 free conversions per day.
- Usage credit statistics MUST be tracked in `localStorage` under `gwmr_daily_video_usage` using Sweden localized date formatting (`YYYY-MM-DD`).

### 3.2 UI/UX Requirements
- **Theme**: Premium dark-mode styling utilizing glassmorphism, responsive CSS grid structures, and Outfit/Inter fonts.
- **Drag & Drop**: Neon-bordered file dropper area that updates dynamically.
- **Dual Player Preview**: Displays original source next to (or above) the cleaned output preview once rendered.
- **Queue Controls**: Allows deleting queue items and clearing active lists.
- **Premium Cards**: Banner prompting users to upgrade to unlock bulk processing and unlimited credits.

---

## 4. Technical Stack & Dependencies

- **HTML5 & JS**: Vanilla ES6 modules.
- **CSS**: Custom vanilla stylesheet using modern custom variables.
- **Libraries**:
  - `mp4box.all.min.js`: Local file demuxer.
  - `mp4-muxer.min.js`: Local container muxer.
- **API Requirements**: WebCodecs API support (Chrome, Edge, Chromium browsers).

---

## 5. Non-Functional Requirements

- **Performance**: Standard 5-second 720p video SHALL render in under 15 seconds.
- **Security**: Zero data leaves the client. No database connections are made.
- **Portability**: Code executes completely as a static SPA and can be deployed on any serverless hosting provider (GitHub Pages, Vercel, Netlify).
