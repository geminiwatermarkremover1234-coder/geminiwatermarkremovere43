# Gemini Video Watermark Remover

A fully client-side, browser-based single page web application cloned from [geminiwatermarkremove.net](https://geminiwatermarkremove.net/gemini-omni-video-watermark-remover). It decodes, processes, and re-encodes MP4 video clips entirely locally on your device to clean the visible Google Gemini Omni or Veo corner logo watermark.

---

## 🚀 Key Features

1. **Local Device Processing**: Zero server uploads, keeping your videos completely private.
2. **Dynamic Logo Detection**: Employs Pearson correlation coefficient calculations over the first 5 frames to automatically target the watermark's exact offset coordinates.
3. **Inverse Alpha Blending Math**: Restores background details behind the semi-transparent logo by reversing alpha-blend formulas and applying edge smoothing.
4. **WebCodecs Speed**: Harnesses modern GPU-accelerated browser `VideoDecoder` and `VideoEncoder` APIs to render H.264 frames smoothly.
5. **Lossless Audio Passthrough**: Copies original AAC audio samples and keeps timestamps in sync.
6. **Premium Dark Dashboard**: Features drag-and-drop file upload, queue tables, live side-by-side original-vs-preview players, and local credit limiters.

---

## 🛠️ Technology Stack

- **Frontend Core**: Vanilla HTML5, ES6 Javascript Modules, and Vanilla CSS custom variables.
- **Demuxer**: [mp4box.all.min.js](vendor/mp4box.all.min.js) (saves video/audio samples).
- **Muxer**: [mp4-muxer.min.js](vendor/mp4-muxer.min.js) (muxes video H.264 & audio AAC tracks).
- **Hardware Acceleration**: Chromium WebCodecs API (`VideoDecoder` / `VideoEncoder`).

---

## 📂 Project Structure

```bash
├── openspec/                     # Specification-driven development home
│   ├── changes/archive/          # Archived changes
│   └── specs/                    # Synced main capabilities specifications
│       ├── video-watermark-remover/
│       └── watermark-remover-ui/
├── vendor/                       # Third-party local library folders
│   ├── mp4-muxer.min.js
│   └── mp4box.all.min.js
├── watermarks/                   # Watermark template asset files
│   ├── bg_48.png                 # 720p logo template mask
│   └── gemini-star_paired_star_overlay.png # 1080p logo template mask
├── app.js                        # Frontend UI controllers & state managers
├── processor.js                  # Video processing engine & mathematical algorithms
├── index.html                    # Main HTML5 layout structure
├── index.css                     # Custom design sheets & responsive variables
├── prd.md                        # Product Requirements Document
├── package.json                  # NPM packages & launch commands
└── README.md                     # This documentation file
```

---

## 🏁 Quick Start

Because this application uses standard ES6 Javascript Modules (`import` / `export`), opening the `index.html` file directly via the browser's `file://` protocol will block imports due to CORS restrictions. The application **must** be served via an HTTP server.

1. **Install and Boot Server**:
   Ensure you have Node.js installed. In the project root, run:
   ```bash
   npm run dev
   ```
   This automatically downloads the lightweight `http-server` and hosts the project.

2. **Access App**:
   Navigate to `http://localhost:3000` in a Chromium-based browser (Chrome or Microsoft Edge).

---

## ⚠️ Browser Compatibility

This tool requires the modern **WebCodecs API** (`VideoDecoder` and `VideoEncoder`) and **local MP4 recording/muxing** support.
- **Fully Supported**: Google Chrome, Microsoft Edge, Opera, Brave (any recent Chromium version).
- **Not Currently Supported**: Mozilla Firefox, Apple Safari (due to missing WebCodecs H.264 encoder support).
