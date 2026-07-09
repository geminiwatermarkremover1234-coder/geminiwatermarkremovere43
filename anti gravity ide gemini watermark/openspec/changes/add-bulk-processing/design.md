## Context

Three entry points share one engine (`processor.js`): Gemini video (queue of 10/1, manual per-item processing), Veo video (single file), Gemini image cleaner (single file, auto + manual modes). WebCodecs `VideoDecoder`/`VideoEncoder` sessions are heavyweight; running two encodes concurrently risks hardware-encoder starvation and OOM on 4K.

## Goals / Non-Goals

**Goals:**
- 20-file queues on all three entry points with one-click batch processing.
- Zero changes to `processor.js` — bulk is pure orchestration above the engine.
- Keep each page's existing look; extend, don't redesign.

**Non-Goals:**
- Parallel processing (sequential by design).
- ZIP packaging for Download All (new dependency; individual downloads suffice).
- Bulk manual image retouch (interactive brush = inherently per-image).
- Real auth/credits changes (mock stays as-is).

## Decisions

### 1. Sequential batch runner, one shared shape
A `processAll` loop: find next `ready` item → process → update item state → continue. Errors mark the item `error` and the loop continues (one bad file must not kill the batch). Reuses each page's existing single-item processing function; the runner only orchestrates. Why not parallel: WebCodecs concurrency is unreliable across GPUs, and sequential keeps progress reporting trivial.

### 2. One queue limit constant, no gating
`MAX_QUEUE = 20` per page. Premium gating on queue size is removed (it is mock UI anyway); the credits counter still decrements per processed video as today. Multi-select enabled unconditionally on file inputs.

### 3. Veo page gets a minimal queue, not the Gemini sidebar
veo-app.js replaces its single `currentFile` with the same item shape used by app.js (`{file, sourceUrl, outputUrl, status, progress, error}`) and renders a simple list above the compare grid: name, status, per-item download button. Selecting an item swaps the compare players. Why not extract a shared queue module: two pages, different DOM; a shared abstraction is more code than the duplication it removes.

### 4. Image bulk = auto mode only, same item shape
`handleSelectedImage` gains a queue path when multiple files arrive in auto mode. Each processed image stores its output blob URL; clicking a queue item shows it in the existing canvas workspace. Switching to manual mode with a queue keeps only the selected image.

### 5. Download All = loop of anchor clicks
One click handler iterating finished items with `a.click()` per file. Chrome prompts once for multiple downloads — acceptable; a ZIP would add JSZip for cosmetics.

### 6. Queue always visible from first file
Drop the `length <= 1` hide rule; show count badge ("3 / 20") and a summary line ("2 done · 1 failed · 1 queued"). Status colors: queued gray, processing accent, done green, failed red.

## Risks / Trade-offs

- **[Risk]** 20 large 4K outputs held as blob URLs can pressure memory. → Mitigation: blobs are already per-item and revoked on remove/clear; documented ceiling, no new behavior.
- **[Risk]** Sequential batch of 20 videos takes long; user may navigate away. → Accepted: progress is visible per item; processing is local-only by design.
- **[Risk]** Multiple-download permission prompt may confuse. → Accepted: one-time browser prompt, standard behavior.

## Open Questions

None.
