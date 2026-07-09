/**
 * VeoClean - page logic for the Veo watermark remover.
 * Uses the shared processor engine with mode "veo".
 * Bulk queue: up to 20 videos, processed sequentially (one WebCodecs session at a time).
 */
import { processVideoWatermark } from './processor.js?v=16';

const SUPPORTED = new Set(["1280x720", "720x1280", "1920x1080", "1080x1920", "3840x2160", "2160x3840"]);
const MAX_QUEUE = 20;

const drop = document.getElementById("veo-drop");
const fileInput = document.getElementById("veo-file");
const agree = document.getElementById("veo-agree");
const processBtn = document.getElementById("veo-process");
const processAllBtn = document.getElementById("veo-process-all");
const downloadBtn = document.getElementById("veo-download");
const downloadAllBtn = document.getElementById("veo-download-all");
const resetBtn = document.getElementById("veo-reset");
const meta = document.getElementById("veo-meta");
const progressBox = document.getElementById("veo-progress");
const stageText = document.getElementById("veo-stage");
const pctText = document.getElementById("veo-pct");
const bar = document.getElementById("veo-bar");
const errBox = document.getElementById("veo-error");
const okBox = document.getElementById("veo-ok");
const queueBox = document.getElementById("veo-queue");
const queueSummary = document.getElementById("veo-queue-summary");
const videosGrid = document.getElementById("veo-videos");
const videosEmpty = document.getElementById("veo-videos-empty");
const srcVideo = document.getElementById("veo-src");
const outVideo = document.getElementById("veo-out");

let queue = []; // { file, sourceUrl, outputUrl, dims, status: ready|processing|done|error, progress, error }
let activeIndex = -1;
let busy = false;

function showError(msg) {
    errBox.innerText = msg;
    errBox.style.display = "block";
    okBox.style.display = "none";
}

function showOk(msg) {
    okBox.innerText = msg;
    okBox.style.display = "block";
    errBox.style.display = "none";
}

function clearAlerts() {
    errBox.style.display = "none";
    okBox.style.display = "none";
}

function getVideoDimensions(file) {
    return new Promise((resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        const url = URL.createObjectURL(file);
        v.onloadedmetadata = () => {
            const dims = { w: v.videoWidth, h: v.videoHeight };
            URL.revokeObjectURL(url);
            resolve(dims);
        };
        v.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not read video metadata. Make sure it is a valid MP4 downloaded directly from Veo / Flow."));
        };
        v.src = url;
    });
}

async function acceptFiles(files) {
    if (busy) return;
    clearAlerts();

    const videos = Array.from(files).filter(f => f.type.startsWith("video/"));
    if (!videos.length) {
        showError("Please choose valid MP4 video files.");
        return;
    }

    const spaceLeft = MAX_QUEUE - queue.length;
    if (spaceLeft <= 0) {
        showError(`Queue limit of ${MAX_QUEUE} videos reached. Process or remove some videos first.`);
        return;
    }
    if (videos.length > spaceLeft) {
        showError(`Only ${spaceLeft} more video(s) can be added (max ${MAX_QUEUE} at a time). Extra files were skipped.`);
    }

    let added = 0;
    for (const file of videos.slice(0, spaceLeft)) {
        let dims;
        try {
            dims = await getVideoDimensions(file);
        } catch (e) {
            showError(`"${file.name}": ${e.message}`);
            continue;
        }
        const key = `${dims.w}x${dims.h}`;
        if (!SUPPORTED.has(key)) {
            showError(`"${file.name}" skipped — unsupported dimensions ${dims.w} x ${dims.h}. Supported: 720p, 1080p, 4K in 16:9 or 9:16. If it came from WhatsApp or social media it was re-encoded — download the original from Veo / Flow instead.`);
            continue;
        }
        queue.push({
            file,
            sourceUrl: URL.createObjectURL(file),
            outputUrl: null,
            dims,
            status: "ready",
            progress: 0,
            error: null
        });
        added++;
    }

    if (added > 0) {
        if (activeIndex === -1) selectItem(queue.length - added);
        renderQueue();
    }
    fileInput.value = "";
}

function selectItem(index) {
    if (index < 0 || index >= queue.length) return;
    activeIndex = index;
    const item = queue[index];

    meta.innerText = `${item.file.name} · ${item.dims.w} x ${item.dims.h} · ${(item.file.size / (1024 * 1024)).toFixed(2)} MB`;
    srcVideo.src = item.sourceUrl;
    if (item.outputUrl) {
        outVideo.src = item.outputUrl;
    } else {
        outVideo.removeAttribute("src");
    }
    videosGrid.style.display = "grid";
    videosGrid.classList.toggle("portrait", item.dims.h > item.dims.w);
    videosEmpty.style.display = "none";

    downloadBtn.style.display = item.outputUrl ? "inline-block" : "none";
    resetBtn.style.display = "inline-block";
    processBtn.disabled = busy || item.status === "processing" || item.status === "done";

    renderQueue();
}

function renderQueue() {
    if (!queue.length) {
        queueBox.style.display = "none";
        queueSummary.style.display = "none";
        processAllBtn.style.display = "none";
        downloadAllBtn.style.display = "none";
        return;
    }

    queueBox.innerHTML = "";
    queueBox.style.display = "flex";

    queue.forEach((item, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `queue-item ${index === activeIndex ? "active" : ""}`;
        el.addEventListener("click", () => { if (!busy) selectItem(index); });

        const details = document.createElement("div");
        details.className = "queue-details";
        const name = document.createElement("span");
        name.className = "queue-name";
        name.innerText = `${index + 1}. ${item.file.name}`;
        const state = document.createElement("span");
        state.className = `queue-state st-${item.status}`;
        state.innerText = item.status === "processing" ? `Processing ${Math.round(item.progress)}%`
            : item.status === "done" ? "✓ Done"
            : item.status === "error" ? "✕ Failed"
            : "Ready";
        details.appendChild(name);
        details.appendChild(state);
        el.appendChild(details);

        if (item.status === "done" && item.outputUrl) {
            const dl = document.createElement("button");
            dl.type = "button";
            dl.className = "queue-icon-btn";
            dl.title = "Download cleaned MP4";
            dl.innerText = "⬇";
            dl.addEventListener("click", (e) => { e.stopPropagation(); downloadItem(item); });
            el.appendChild(dl);
        }

        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "queue-icon-btn rm";
        rm.title = "Remove from queue";
        rm.innerText = "✕";
        rm.addEventListener("click", (e) => { e.stopPropagation(); removeItem(index); });
        el.appendChild(rm);

        queueBox.appendChild(el);
    });

    const done = queue.filter(i => i.status === "done").length;
    const failed = queue.filter(i => i.status === "error").length;
    const pending = queue.filter(i => i.status === "ready").length;
    queueSummary.style.display = "block";
    queueSummary.innerText = `${queue.length} / ${MAX_QUEUE} in queue — ${done} done · ${failed} failed · ${pending} queued`;

    const pendingOrFailed = queue.filter(i => i.status === "ready" || i.status === "error").length;
    processAllBtn.style.display = pendingOrFailed > 1 && !busy ? "inline-block" : "none";
    processAllBtn.innerText = `Remove From All (${pendingOrFailed})`;
    downloadAllBtn.style.display = done > 1 ? "inline-block" : "none";
    downloadAllBtn.innerText = `Download All (${done})`;
}

function removeItem(index) {
    const item = queue[index];
    if (busy || !item || item.status === "processing") return;
    if (item.sourceUrl) URL.revokeObjectURL(item.sourceUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    queue.splice(index, 1);

    if (!queue.length) {
        reset();
        return;
    }
    if (index === activeIndex) {
        selectItem(Math.min(index, queue.length - 1));
    } else {
        if (index < activeIndex) activeIndex--;
        renderQueue();
    }
}

async function processItem(index, batchLabel) {
    const item = queue[index];
    item.status = "processing";
    item.progress = 0;
    item.error = null;
    renderQueue();

    const buf = await item.file.arrayBuffer();
    const blob = await processVideoWatermark(buf, "veo", "auto", (p) => {
        let pct = 0;
        const prefix = batchLabel ? `${batchLabel} · ` : "";
        if (p.stage === "demux") { pct = p.ratio * 8; stageText.innerText = prefix + "Reading video"; }
        else if (p.stage === "process") { pct = 8 + p.ratio * 88; stageText.innerText = prefix + "Erasing Veo watermark"; }
        else if (p.stage === "mux") { pct = 97; stageText.innerText = prefix + "Finalizing"; }
        else if (p.stage === "done") { pct = 100; stageText.innerText = prefix + "Completed"; }
        item.progress = pct;
        pctText.innerText = `${Math.round(pct)}%`;
        bar.style.width = `${pct}%`;
        renderQueue();
    });

    item.outputUrl = URL.createObjectURL(blob);
    item.status = "done";
    if (index === activeIndex) {
        outVideo.src = item.outputUrl;
        downloadBtn.style.display = "inline-block";
    }
    renderQueue();
}

function setBusy(b) {
    busy = b;
    processBtn.disabled = b || activeIndex === -1 || queue[activeIndex]?.status !== "ready";
    processAllBtn.disabled = b;
    downloadAllBtn.disabled = b;
    resetBtn.disabled = b;
}

async function run() {
    if (activeIndex === -1 || busy) return;
    const item = queue[activeIndex];
    if (item.status === "processing" || item.status === "done") return;
    if (!agree.checked) {
        showError("Please confirm that you own this media or have permission to edit it.");
        return;
    }

    setBusy(true);
    clearAlerts();
    progressBox.style.display = "block";
    bar.style.width = "0%";

    try {
        await processItem(activeIndex);
        showOk("Veo watermark removed. Preview the result below, then download.");
    } catch (err) {
        console.error("Veo processing failed:", err);
        item.status = "error";
        item.error = err.message || "Processing failed unexpectedly.";
        showError(item.error);
    } finally {
        setBusy(false);
        progressBox.style.display = "none";
        renderQueue();
    }
}

async function runAll() {
    if (busy) return;
    if (!agree.checked) {
        showError("Please confirm that you own this media or have permission to edit it.");
        return;
    }
    const pending = queue.map((item, i) => (item.status === "ready" || item.status === "error") ? i : -1).filter(i => i !== -1);
    if (!pending.length) return;

    setBusy(true);
    clearAlerts();
    progressBox.style.display = "block";
    bar.style.width = "0%";

    let done = 0, failed = 0;
    for (let n = 0; n < pending.length; n++) {
        const idx = pending[n];
        selectItem(idx);
        try {
            await processItem(idx, `Video ${n + 1}/${pending.length}`);
            done++;
        } catch (err) {
            console.error("Bulk Veo processing failed:", err);
            queue[idx].status = "error";
            queue[idx].error = err.message || "Processing failed.";
            failed++;
        }
    }

    setBusy(false);
    progressBox.style.display = "none";
    renderQueue();
    if (done > 0) showOk(`Bulk processing finished: ${done} cleaned${failed ? `, ${failed} failed` : ""}. Use Download All to save them.`);
    else if (failed > 0) showError("All videos in the batch failed. Make sure they are original Veo / Flow MP4s.");
}

function reset() {
    if (busy) return;
    queue.forEach(item => {
        if (item.sourceUrl) URL.revokeObjectURL(item.sourceUrl);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    });
    queue = [];
    activeIndex = -1;
    srcVideo.removeAttribute("src");
    outVideo.removeAttribute("src");
    videosGrid.style.display = "none";
    videosEmpty.style.display = "block";
    meta.innerText = "";
    processBtn.disabled = true;
    downloadBtn.style.display = "none";
    downloadAllBtn.style.display = "none";
    processAllBtn.style.display = "none";
    resetBtn.style.display = "none";
    progressBox.style.display = "none";
    queueBox.style.display = "none";
    queueSummary.style.display = "none";
    queueBox.innerHTML = "";
    clearAlerts();
    fileInput.value = "";
}

function downloadItem(item) {
    if (!item.outputUrl) return;
    const a = document.createElement("a");
    a.href = item.outputUrl;
    a.download = item.file.name.replace(/\.[^/.]+$/, "") + "-veoclean.mp4";
    a.click();
}

function download() {
    if (activeIndex === -1) return;
    downloadItem(queue[activeIndex]);
}

async function downloadAll() {
    const done = queue.filter(i => i.status === "done" && i.outputUrl);
    for (const item of done) {
        downloadItem(item);
        // small delay so browsers don't drop successive downloads
        await new Promise(r => setTimeout(r, 350));
    }
}

drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    if (e.dataTransfer.files?.length) acceptFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", (e) => { if (e.target.files?.length) acceptFiles(e.target.files); });
processBtn.addEventListener("click", run);
processAllBtn.addEventListener("click", runAll);
downloadBtn.addEventListener("click", download);
downloadAllBtn.addEventListener("click", downloadAll);
resetBtn.addEventListener("click", reset);
