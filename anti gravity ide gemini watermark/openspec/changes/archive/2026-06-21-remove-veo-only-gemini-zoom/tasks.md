## 1. UI Cleanup & Enhancements

- [x] 1.1 Remove Google Veo subtabs, navbar/footer links, descriptions, and FAQs from `index.html`.
- [x] 1.2 Add a zoom/maximize button overlay inside the cleaned video container and a hidden zoom modal structure in `index.html`.
- [x] 1.3 Add CSS styles in `index.css` for the zoom button and fullscreen modal overlay.

## 2. Controller & Processor Logic

- [x] 2.1 Simplify `app.js` to remove Veo event listeners, tab switching, and state.
- [x] 2.2 Implement zoom icon click handlers and escape-key close listeners in `app.js`.
- [x] 2.3 Modify `processor.js` to remove Veo branches and focus entirely on Gemini Omni watermarks.

## 3. Verification

- [x] 3.1 Open app in browser and upload a Gemini video to process.
- [x] 3.2 Click the zoom icon after completion and take a screenshot of the video in fullscreen zoom mode to verify clean erasure.
