## Why

Users process many generated clips per session. Today the Gemini page queues at most 10 videos (1 without the mock premium flag) and processes one at a time on manual clicks; the Veo page and the image cleaner accept a single file each. Batch work means constant babysitting.

## What Changes

- Raise the video queue limit to 20 on the Gemini page and remove the premium/free queue-size gating (multi-select always enabled; mock credits stay).
- Add a queue to the Veo page: up to 20 videos, per-item status/progress, per-item download.
- Add bulk support to the Gemini image cleaner (auto mode): up to 20 images queued, per-item status, per-item download. Manual retouch mode stays single-image (it is an interactive brush workflow).
- Add "Process All" to all three queues: sequential processing (WebCodecs encoder/decoder must not run concurrently), auto-advancing with live per-item progress.
- Add "Download All" per queue: triggers each finished item's download.
- Queue UI/UX fixes: queue list visible from the first file (currently hidden until 2+), status color-coding (queued/processing/done/failed), item count badge, batch summary line, controls disabled while a batch runs.

## Capabilities

### New Capabilities
- `bulk-processing`: queueing up to 20 media files, sequential batch execution, per-item status/progress/download, batch download.

### Modified Capabilities
<!-- watermark-remover-ui requirements on queue display change, folded into bulk-processing spec to keep one home for queue behavior -->

## Impact

- `app.js`: queue limit + gating, Process All / Download All for videos; image auto-mode queue.
- `veo-app.js`: single-file state replaced by a queue + batch runner.
- `index.html`, `veo.html`: queue list markup, Process All / Download All buttons.
- `index.css`: queue status styles.
- `processor.js`: untouched.
