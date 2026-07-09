## 1. Gemini video queue (app.js / index.html)

- [ ] 1.1 `MAX_QUEUE = 20`; remove premium/free queue-size gating in `handleSelectedFiles`; `fileInput.multiple = true` unconditionally.
- [ ] 1.2 Queue list visible from first item (drop `length <= 1` hide); add count badge + summary line; per-item status styling (queued/processing/done/failed) and per-item download button.
- [ ] 1.3 Add "Process All": sequential runner reusing `triggerVideoProcessing` logic per item; continue on error; lock controls during batch.
- [ ] 1.4 Add "Download All" for finished items.

## 2. Veo queue (veo-app.js / veo.html)

- [ ] 2.1 Replace single `currentFile` state with queue of items (cap 20), multi-select + multi-drop.
- [ ] 2.2 Queue list UI: name, status, remove, per-item download; click selects item into compare players.
- [ ] 2.3 "Process All" sequential runner + "Download All"; per-item progress in list; controls locked during batch.

## 3. Gemini image bulk (app.js / index.html)

- [ ] 3.1 Auto mode accepts multiple images (cap 20) into an image queue; manual mode stays single-image.
- [ ] 3.2 Image queue list with statuses + per-item download; "Process All" sequential; "Download All".

## 4. Styles (index.css)

- [ ] 4.1 Queue status colors, count badge, summary line, download-item button.

## 5. Verify in browser (chrome-devtools MCP)

- [ ] 5.1 Multi-upload videos on both pages; Process All; statuses advance sequentially; failure continues batch.
- [ ] 5.2 Multi-upload images in auto mode; Process All; outputs viewable + downloadable.
- [ ] 5.3 Queue visible with 1 file; over-limit message at 20.
