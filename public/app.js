import { processVideoWatermark, cleanImageWatermarkAuto, cleanImageWatermarkManual } from './processor.js?v=16';

// Adsterra Ads Configuration
const ADSTERRA_CONFIG = {
    enabled: true,
    domain: 'www.highperformanceformat.com', 
    smartlink: 'https://www.effectivecpmnetwork.com/s6dtym12bw?key=030513107fcec21d9592501debed4142',
    placements: {
        topBanner: '30196363',      // 728x90_1
        belowUpload: '30196361',    // 300x250_1
        belowResult: '30196361',    // 300x250_1
        leftSidebar: '30196362',    // 160x600_1
        rightSidebar: '30196362',   // 160x600_1
        stickyMobile: '30196360',    // 320x50_1
        socialBar: '30196365'       // SocialBar_1
    }
};

function loadAdsterraAd(containerId, slotKey, width, height) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Clear previous ad
    container.innerHTML = "";
    
    if (!ADSTERRA_CONFIG.enabled || !slotKey || slotKey.startsWith("YOUR_")) {
        container.innerHTML = `<div class="text-on-surface-variant/20 italic p-4 text-center">Advertisement (${width}x${height})</div>`;
        return;
    }

    const frame = document.createElement("iframe");
    frame.src = `about:blank`;
    frame.width = width;
    frame.height = height;
    frame.scrolling = "no";
    frame.frameBorder = "0";
    frame.style.border = "none";
    frame.style.overflow = "hidden";
    
    container.appendChild(frame);
    
    try {
        const frameDoc = frame.contentWindow.document || frame.contentDocument;
        frameDoc.open();
        frameDoc.write(`
            <!DOCTYPE html>
            <html>
            <head><style>body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; background: transparent; }</style></head>
            <body>
                <script type="text/javascript">
                    atOptions = {
                        'key' : '${slotKey}',
                        'format' : 'iframe',
                        'height' : ${height},
                        'width' : ${width},
                        'params' : {}
                    };
                </script>
                <script type="text/javascript" src="//${ADSTERRA_CONFIG.domain}/${slotKey}/invoke.js"></script>
            </body>
            </html>
        `);
        frameDoc.close();
    } catch (e) {
        console.error("Failed to load ad frame:", e);
    }
}

function loadAdsterraSocialBar() {
    const slotKey = ADSTERRA_CONFIG.placements.socialBar;
    if (!ADSTERRA_CONFIG.enabled || !slotKey || slotKey.startsWith("YOUR_")) return;
    
    if (document.getElementById(`ad-socialbar-script`)) return;

    const script = document.createElement("script");
    script.id = `ad-socialbar-script`;
    script.type = "text/javascript";
    script.src = `//${ADSTERRA_CONFIG.domain}/${slotKey}/invoke.js`;
    document.body.appendChild(script);
}

function showInterstitialAdGate(onUnlock) {
    const modal = document.getElementById("ad-interstitial-modal");
    const timerText = document.getElementById("ad-timer-text");
    const unlockBtn = document.getElementById("ad-unlock-btn");
    const unlockBtnText = document.getElementById("ad-unlock-btn-text");
    
    if (!modal) {
        onUnlock();
        return;
    }
    
    // Show modal
    modal.classList.remove("hidden");
    
    // Load banner inside interstitial
    loadAdsterraAd("ad-interstitial-banner", ADSTERRA_CONFIG.placements.belowResult, 300, 250);
    
    // Load Social Bar ad
    loadAdsterraSocialBar();
    
    // Start countdown
    let timeLeft = 5;
    unlockBtn.disabled = true;
    timerText.innerText = `Preparing your download link... ${timeLeft}s`;
    unlockBtnText.innerText = `Close Ad & Download (${timeLeft}s)`;
    
    const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(interval);
            timerText.innerText = "Your download is ready!";
            unlockBtnText.innerText = "Close Ad & Download";
            unlockBtn.disabled = false;
        } else {
            timerText.innerText = `Preparing your download link... ${timeLeft}s`;
            unlockBtnText.innerText = `Close Ad & Download (${timeLeft}s)`;
        }
    }, 1000);
    
    const unlockHandler = () => {
        clearInterval(interval);
        
        // Hide modal
        modal.classList.add("hidden");
        
        // Call unlock callback to trigger auto download
        onUnlock();
        
        unlockBtn.removeEventListener("click", unlockHandler);
    };
    
    unlockBtn.addEventListener("click", unlockHandler);
}

// Application State
let activeQueue = [];
let activeVideoIndex = -1;
let isBulkProcessing = false;
let isPremium = false;
let isLoggedIn = false;
let videoOpacityMode = "auto"; // auto, soft, normal
let imageOpacityMode = "auto"; // auto, soft, normal
// videoStudioMode is deprecated; we only support gemini mode now

// DOM Elements
const header = document.getElementById("header");
const mockAvatar = document.getElementById("mock-avatar");
const loginBtn = document.getElementById("login-btn");
const creditBadgeText = document.getElementById("credit-badge-text");
const premiumBadge = document.getElementById("premium-badge");
const navGeminiVideo = document.getElementById("nav-gemini-video");
const zoomVideoBtn = document.getElementById("zoom-video-btn");
const zoomModal = document.getElementById("zoom-modal");
const zoomModalBackdrop = document.getElementById("zoom-modal-backdrop");
const zoomModalClose = document.getElementById("zoom-modal-close");
const zoomVideo = document.getElementById("zoom-video");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const previewGrid = document.getElementById("preview-grid");
const srcVideo = document.getElementById("src-video");
const destVideoContainer = document.getElementById("dest-video-container");
const destVideo = document.getElementById("dest-video");

const queueStatusText = document.getElementById("queue-status-text");
const videoDimsText = document.getElementById("video-dims-text");
const queueContainer = document.getElementById("queue-container");

const creditsFraction = document.getElementById("credits-fraction");
const creditsBar = document.getElementById("credits-bar");
const creditsLimitDesc = document.getElementById("credits-limit-desc");
const loginCreditsLink = document.getElementById("login-credits-link");

const statusErrorAlert = document.getElementById("status-error-alert");
const errorMessageText = document.getElementById("error-message-text");
const statusSuccessAlert = document.getElementById("status-success-alert");

const progressPanel = document.getElementById("progress-panel");
const processStageText = document.getElementById("process-stage-text");
const processPercentageText = document.getElementById("process-percentage-text");
const processBar = document.getElementById("process-bar");

const chooseVideoBtn = document.getElementById("choose-video-btn");
const chooseBtnText = document.getElementById("choose-btn-text");
const processVideoBtn = document.getElementById("process-video-btn");
const processAllBtn = document.getElementById("process-all-btn");
const downloadVideoBtn = document.getElementById("download-video-btn");
const downloadAllBtn = document.getElementById("download-all-btn");
const clearQueueBtn = document.getElementById("clear-queue-btn");
const upgradeBtn = document.getElementById("upgrade-btn");
const premiumCard = document.getElementById("premium-card");

const demoVideoWrapper = document.getElementById("demo-video-wrapper");
const contactBtn = document.getElementById("contact-btn");

// Opacity mode elements
const opacityAutoBtn = document.getElementById("opacity-auto");
const opacitySoftBtn = document.getElementById("opacity-soft");
const opacityNormalBtn = document.getElementById("opacity-normal");
const agreeCheckbox = document.getElementById("agree-checkbox");

// Image opacity mode elements
const imgOpacityAutoBtn = document.getElementById("img-opacity-auto");
const imgOpacitySoftBtn = document.getElementById("img-opacity-soft");
const imgOpacityNormalBtn = document.getElementById("img-opacity-normal");
const imgAgreeCheckbox = document.getElementById("img-agree-checkbox");

// Supported Dimensions Set
const SUPPORTED_DIMENSIONS = new Set(["1280x720", "720x1280", "1920x1080", "1080x1920", "3840x2160", "2160x3840", "848x478", "478x848"]);

// Bulk queue limits
const MAX_QUEUE_SIZE = 20;
const MAX_IMAGE_QUEUE_SIZE = 20;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    initCredits();
    setupHeaderScroll();
    setupDropzone();
    setupEventListeners();

    // Load static ads
    loadAdsterraAd("ad-top-banner", ADSTERRA_CONFIG.placements.topBanner, 728, 90);
    loadAdsterraAd("ad-left-sidebar", ADSTERRA_CONFIG.placements.leftSidebar, 160, 600);
    loadAdsterraAd("ad-right-sidebar", ADSTERRA_CONFIG.placements.rightSidebar, 160, 600);
    loadAdsterraAd("ad-sticky-mobile-banner", ADSTERRA_CONFIG.placements.stickyMobile, 320, 50);
    loadAdsterraAd("ad-below-upload-container", ADSTERRA_CONFIG.placements.belowUpload, 300, 250);
});

// Credits System implementation matching target site
const LOCAL_STORAGE_CREDITS_KEY = "gwmr_daily_video_usage";

function getTodayString() {
    return new Date().toLocaleDateString("sv-SE"); // Returns YYYY-MM-DD
}

function getUsedCreditsCount() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_CREDITS_KEY);
        if (!stored) return 0;
        const parsed = JSON.parse(stored);
        if (parsed.date !== getTodayString()) {
            localStorage.removeItem(LOCAL_STORAGE_CREDITS_KEY);
            return 0;
        }
        return parsed.count || 0;
    } catch (e) {
        localStorage.removeItem(LOCAL_STORAGE_CREDITS_KEY);
        return 0;
    }
}

function incrementCreditsUsage() {
    if (isPremium) return;
    const count = getUsedCreditsCount() + 1;
    try {
        localStorage.setItem(LOCAL_STORAGE_CREDITS_KEY, JSON.stringify({
            date: getTodayString(),
            count
        }));
    } catch (e) {
        console.error("Failed to write to localStorage:", e);
    }
    updateCreditsUI();
}

function initCredits() {
    updateCreditsUI();
}

function updateCreditsUI() {
    if (isPremium) {
        creditBadgeText.innerText = `👑 Premium | Queue: ${activeQueue.length}/${MAX_QUEUE_SIZE}`;
        premiumBadge.classList.add("premium");

        creditsFraction.innerText = "Unlimited";
        creditsBar.style.width = "100%";
        creditsLimitDesc.innerHTML = "Your Premium subscription gives you unlimited daily video processing.";
        premiumCard.style.display = "none";
        return;
    }

    const limit = isLoggedIn ? 6 : 3;
    const used = getUsedCreditsCount();
    const remaining = Math.max(0, limit - used);

    creditBadgeText.innerText = `Free mode: ${remaining}/${limit} daily videos left`;
    premiumBadge.classList.remove("premium");

    creditsFraction.innerText = `${remaining} / ${limit} left`;
    const percentage = (remaining / limit) * 100;
    creditsBar.style.width = `${percentage}%`;

    if (remaining <= 0) {
        if (isLoggedIn) {
            creditsLimitDesc.innerHTML = `You have used all your 6 daily videos. <a href="#" class="credits-link" id="upgrade-now-link">Upgrade to Premium</a> for unlimited conversions.`;
        } else {
            creditsLimitDesc.innerHTML = `You have used all your 3 daily videos. <a href="#" class="credits-link" id="login-now-link">Sign in</a> to get 3 more, or <a href="#" class="credits-link" id="upgrade-now-link">upgrade to Premium</a>.`;
        }
    } else {
        if (isLoggedIn) {
            creditsLimitDesc.innerHTML = `Logged-in free plan gets 6 credits/day.`;
        } else {
            creditsLimitDesc.innerHTML = `Guest limit: 3/day. <a href="#" class="credits-link" id="login-now-link">Sign in</a> to get 6.`;
        }
    }

    // Bind dynamic link event listeners
    const upgradeNowLink = document.getElementById("upgrade-now-link");
    const loginNowLink = document.getElementById("login-now-link");
    if (upgradeNowLink) upgradeNowLink.addEventListener("click", triggerUpgrade);
    if (loginNowLink) loginNowLink.addEventListener("click", triggerLoginToggle);

    // Disable process button if no credits left
    updateProcessButtonState();
}

function updateProcessButtonState() {
    if (activeVideoIndex === -1 || isBulkProcessing) {
        processVideoBtn.disabled = true;
        return;
    }
    const currentVideo = activeQueue[activeVideoIndex];
    if (currentVideo.status === "processing") {
        processVideoBtn.disabled = true;
        return;
    }

    if (isPremium) {
        processVideoBtn.disabled = false;
        return;
    }

    const limit = isLoggedIn ? 6 : 3;
    const remaining = Math.max(0, limit - getUsedCreditsCount());
    processVideoBtn.disabled = (remaining <= 0);
}

// Header scroll color shift
function setupHeaderScroll() {
    window.addEventListener("scroll", () => {
        if (window.scrollY > 20) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    });
}

// Dropzone file handles
function setupDropzone() {
    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--primary)";
        dropzone.style.background = "rgba(138, 43, 226, 0.05)";
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.style.borderColor = "rgba(255, 255, 255, 0.15)";
        dropzone.style.background = "transparent";
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "rgba(255, 255, 255, 0.15)";
        dropzone.style.background = "transparent";

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleSelectedFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleSelectedFiles(e.target.files);
        }
    });
}

// Handles selecting video files
async function handleSelectedFiles(files) {
    statusErrorAlert.style.display = "none";
    statusSuccessAlert.style.display = "none";

    const filtered = Array.from(files).filter(f => f.type.startsWith("video/"));
    if (filtered.length === 0) {
        showError("Please upload a valid MP4 video file.");
        return;
    }

    const spaceLeft = MAX_QUEUE_SIZE - activeQueue.length;

    if (spaceLeft <= 0) {
        showError(`Queue limit of ${MAX_QUEUE_SIZE} videos reached. Process or clear some videos first.`);
        return;
    }

    if (filtered.length > spaceLeft) {
        showError(`Only ${spaceLeft} more video(s) can be added (max ${MAX_QUEUE_SIZE} at a time). Extra files were skipped.`);
    }

    const filesToLoad = filtered.slice(0, spaceLeft);

    for (const file of filesToLoad) {
        try {
            const videoDims = await getVideoDimensions(file);
            if (!SUPPORTED_DIMENSIONS.has(videoDims)) {
                showError(`Unsupported dimensions: ${videoDims.replace("x", " x ")}. Supported: 720p (1280x720), 1080p (1920x1080), 4K (3840x2160) in 16:9 or 9:16. If this video came from WhatsApp or social media it was re-encoded and resized — download the original MP4 directly from Gemini and upload that instead.`);
                continue;
            }

            const sourceUrl = URL.createObjectURL(file);
            const queueItem = {
                id: crypto.randomUUID(),
                file,
                sourceUrl,
                outputUrl: null,
                dimensions: videoDims,
                status: "ready", // ready, processing, done, error
                progress: 0,
                error: null,
                mode: "gemini"
            };

            activeQueue.push(queueItem);
        } catch (e) {
            showError("Could not retrieve video dimensions. Make sure the file is a valid MP4 downloaded directly from Gemini (not forwarded via WhatsApp or social media).");
        }
    }

    if (activeQueue.length > 0) {
        if (activeVideoIndex === -1) {
            selectQueueItem(0);
        }
        renderQueueList();
    }

    fileInput.value = ""; // reset
}

// Reads dimensions of MP4 file via HTML5 video metadata loading
function getVideoDimensions(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        const url = URL.createObjectURL(file);
        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(`${video.videoWidth}x${video.videoHeight}`);
        };
        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Video dimensions reading failed."));
        };
        video.src = url;
    });
}

function selectQueueItem(index) {
    if (index < 0 || index >= activeQueue.length) return;
    activeVideoIndex = index;
    const item = activeQueue[index];

    // Hide dropzone, show preview grid
    dropzone.style.display = "none";
    previewGrid.style.display = "grid";

    srcVideo.src = item.sourceUrl;

    if (item.outputUrl) {
        destVideo.src = item.outputUrl;
        destVideoContainer.style.display = "flex";
        downloadVideoBtn.style.display = "inline-flex";
        previewGrid.className = "video-matched-grid w-full has-output";

        // Show below-result ad, hide below-upload
        document.getElementById("ad-below-upload-wrapper").style.display = "none";
        document.getElementById("ad-below-result-wrapper").style.display = "flex";
        loadAdsterraAd("ad-below-result-container", ADSTERRA_CONFIG.placements.belowResult, 300, 250);
    } else {
        destVideo.removeAttribute("src");
        destVideoContainer.style.display = "none";
        downloadVideoBtn.style.display = "none";
        previewGrid.className = "video-matched-grid w-full";

        // Show below-upload ad, hide below-result
        document.getElementById("ad-below-upload-wrapper").style.display = "flex";
        document.getElementById("ad-below-result-wrapper").style.display = "none";
        loadAdsterraAd("ad-below-upload-container", ADSTERRA_CONFIG.placements.belowUpload, 300, 250);
    }

    // Sidebar text info
    queueStatusText.innerText = item.file.name;
    videoDimsText.innerText = `${item.dimensions.replace("x", " x ")} | ${(item.file.size / (1024 * 1024)).toFixed(2)} MB`;

    // Alerts state
    if (item.status === "error") {
        showError(item.error || "Video processing failed.");
        statusSuccessAlert.style.display = "none";
    } else if (item.status === "done") {
        statusErrorAlert.style.display = "none";
        statusSuccessAlert.style.display = "none";
    } else {
        statusErrorAlert.style.display = "none";
        statusSuccessAlert.style.display = "flex";
    }

    // Toggle Clear Queue button
    clearQueueBtn.style.display = "inline-flex";

    updateCreditsUI();
}

function renderQueueList() {
    if (activeQueue.length === 0) {
        queueContainer.style.display = "none";
        updateBulkControls();
        return;
    }

    queueContainer.innerHTML = "";
    queueContainer.style.display = "flex";

    activeQueue.forEach((item, index) => {
        const qItem = document.createElement("button");
        qItem.className = `queue-item ${index === activeVideoIndex ? 'active' : ''}`;
        qItem.type = "button";
        qItem.addEventListener("click", () => selectQueueItem(index));

        const detailBox = document.createElement("div");
        detailBox.className = "queue-details";

        const nameSpan = document.createElement("span");
        nameSpan.className = "queue-name";
        nameSpan.innerText = `${index + 1}. ${item.file.name}`;

        const statusSpan = document.createElement("span");
        statusSpan.className = `queue-status status-${item.status}`;

        if (item.status === "processing") {
            statusSpan.innerText = `Processing ${Math.round(item.progress)}%`;
        } else if (item.status === "done") {
            statusSpan.innerText = "✓ Done";
        } else if (item.status === "error") {
            statusSpan.innerText = "✕ Failed";
        } else {
            statusSpan.innerText = "Ready";
        }

        detailBox.appendChild(nameSpan);
        detailBox.appendChild(statusSpan);
        qItem.appendChild(detailBox);

        if (item.status === "done" && item.outputUrl) {
            const dlBtn = document.createElement("button");
            dlBtn.className = "queue-dl-btn";
            dlBtn.title = "Download cleaned MP4";
            dlBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            `;
            dlBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                downloadQueueItem(item);
            });
            qItem.appendChild(dlBtn);
        }

        const removeBtn = document.createElement("button");
        removeBtn.className = "queue-remove-btn";
        removeBtn.title = "Remove from queue";
        removeBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
        `;
        removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            removeQueueItem(index);
        });

        qItem.appendChild(removeBtn);
        queueContainer.appendChild(qItem);
    });

    updateBulkControls();
}

// Shows/hides "Remove From All" and "Download All" based on queue state
function updateBulkControls() {
    const pendingCount = activeQueue.filter(i => i.status === "ready" || i.status === "error").length;
    const doneCount = activeQueue.filter(i => i.status === "done" && i.outputUrl).length;

    if (pendingCount > 1 && !isBulkProcessing) {
        processAllBtn.style.display = "inline-flex";
        document.getElementById("process-all-btn-text").innerText = `Remove From All (${pendingCount})`;
    } else if (!isBulkProcessing) {
        processAllBtn.style.display = "none";
    }

    if (doneCount > 1) {
        downloadAllBtn.style.display = "inline-flex";
        document.getElementById("download-all-btn-text").innerText = `Download All (${doneCount})`;
    } else {
        downloadAllBtn.style.display = "none";
    }
}

function removeQueueItem(index) {
    const removedItem = activeQueue[index];
    if (isBulkProcessing || (removedItem && removedItem.status === "processing")) return;

    // Revoke blobs
    if (removedItem.sourceUrl) URL.revokeObjectURL(removedItem.sourceUrl);
    if (removedItem.outputUrl) URL.revokeObjectURL(removedItem.outputUrl);

    activeQueue.splice(index, 1);

    if (activeQueue.length === 0) {
        activeVideoIndex = -1;
        resetToEmptyState();
    } else {
        if (activeVideoIndex === index) {
            // Pick neighboring index
            const newIndex = Math.min(index, activeQueue.length - 1);
            selectQueueItem(newIndex);
        } else if (activeVideoIndex > index) {
            activeVideoIndex--;
        }
        renderQueueList();
    }
}

function resetToEmptyState() {
    activeQueue = [];
    activeVideoIndex = -1;

    dropzone.style.display = "flex";
    previewGrid.style.display = "none";
    destVideoContainer.style.display = "none";
    destVideo.removeAttribute("src");
    srcVideo.removeAttribute("src");

    queueStatusText.innerText = "No video selected";
    videoDimsText.innerText = "";
    queueContainer.style.display = "none";
    statusSuccessAlert.style.display = "none";
    statusErrorAlert.style.display = "none";
    downloadVideoBtn.style.display = "none";
    clearQueueBtn.style.display = "none";
    processAllBtn.style.display = "none";
    downloadAllBtn.style.display = "none";

    updateCreditsUI();
}

function showError(msg) {
    errorMessageText.innerText = msg;
    statusErrorAlert.style.display = "flex";
    statusSuccessAlert.style.display = "none";
}

// Throws a flagged error when the daily free credit budget is used up
function ensureCreditsAvailable() {
    if (isPremium) return;
    const limit = isLoggedIn ? 6 : 3;
    if (limit - getUsedCreditsCount() <= 0) {
        const err = new Error("Daily credit limit reached. Please upgrade to Premium.");
        err.creditsExhausted = true;
        throw err;
    }
}

// Core per-item watermark removal shared by single & bulk flows
async function processQueueItem(index, bulkInfo) {
    const item = activeQueue[index];

    ensureCreditsAvailable();

    item.status = "processing";
    item.progress = 0;
    item.error = null;
    renderQueueList();

    const bulkPrefix = bulkInfo ? `Video ${bulkInfo.current}/${bulkInfo.total} — ` : "";
    const arrayBuffer = await item.file.arrayBuffer();

    const resultBlob = await processVideoWatermark(arrayBuffer, item.mode, videoOpacityMode, (progress) => {
        // Callback for progress updates
        let pct = 0;
        let stage = "Processing";
        if (progress.stage === "demux") {
            pct = progress.ratio * 8;
            stage = "Demuxing Video";
        } else if (progress.stage === "process") {
            pct = 8 + (progress.ratio * 88);
            stage = "Erasing Watermarks";
        } else if (progress.stage === "mux") {
            pct = 97;
            stage = "Finalizing Output";
        } else if (progress.stage === "done") {
            pct = 100;
            stage = "Completed";
        }

        item.progress = pct;
        processStageText.innerText = bulkPrefix + stage;
        processPercentageText.innerText = `${Math.round(pct)}%`;
        processBar.style.width = `${pct}%`;

        // Re-render queue item percentages
        renderQueueList();
    });

    // Processing success - show ad gate for single file, skip during bulk processing loop
    if (bulkInfo) {
        item.outputUrl = URL.createObjectURL(resultBlob);
        item.status = "done";
        incrementCreditsUsage();

        if (index === activeVideoIndex) {
            destVideo.src = item.outputUrl;
            destVideoContainer.style.display = "flex";
            previewGrid.className = "video-matched-grid w-full has-output";
        }
        renderQueueList();
        return Promise.resolve();
    } else {
        return new Promise((resolve) => {
            showInterstitialAdGate(() => {
                item.outputUrl = URL.createObjectURL(resultBlob);
                item.status = "done";
                incrementCreditsUsage();

                if (index === activeVideoIndex) {
                    destVideo.src = item.outputUrl;
                    destVideoContainer.style.display = "flex";
                    downloadVideoBtn.style.display = "inline-flex";
                    previewGrid.className = "video-matched-grid w-full has-output";
                    
                    // Show below-result ad, hide below-upload
                    document.getElementById("ad-below-upload-wrapper").style.display = "none";
                    document.getElementById("ad-below-result-wrapper").style.display = "flex";
                    loadAdsterraAd("ad-below-result-container", ADSTERRA_CONFIG.placements.belowResult, 300, 250);
                }
                renderQueueList();
                resolve();
            });
        });
    }
}

// Triggers watermark removal for the selected video only
async function triggerVideoProcessing() {
    if (activeVideoIndex === -1 || isBulkProcessing) return;

    const item = activeQueue[activeVideoIndex];
    if (item.status === "processing") return;

    // Check agree checkbox
    if (!agreeCheckbox.checked) {
        showError("Please confirm that you own this media or have permission to edit it.");
        return;
    }

    statusSuccessAlert.style.display = "none";
    statusErrorAlert.style.display = "none";
    progressPanel.style.display = "flex";
    disableControlsDuringProcessing(true);

    try {
        await processQueueItem(activeVideoIndex);
    } catch (err) {
        console.error("Video conversion failed:", err);
        item.status = err.creditsExhausted ? "ready" : "error";
        item.error = err.message || "An unexpected error occurred during rendering.";
        showError(item.error);
    } finally {
        progressPanel.style.display = "none";
        disableControlsDuringProcessing(false);
        renderQueueList();
        updateCreditsUI();
    }
}

// Bulk: process every pending video in the queue sequentially (up to 20)
async function triggerBulkVideoProcessing() {
    if (isBulkProcessing) return;

    // Check agree checkbox
    if (!agreeCheckbox.checked) {
        showError("Please confirm that you own this media or have permission to edit it.");
        return;
    }

    const pendingIndexes = activeQueue
        .map((item, i) => (item.status === "ready" || item.status === "error") ? i : -1)
        .filter(i => i !== -1);

    if (pendingIndexes.length === 0) return;

    isBulkProcessing = true;
    statusSuccessAlert.style.display = "none";
    statusErrorAlert.style.display = "none";
    progressPanel.style.display = "flex";
    disableControlsDuringProcessing(true);

    let processedCount = 0;
    let failedCount = 0;

    for (let n = 0; n < pendingIndexes.length; n++) {
        const idx = pendingIndexes[n];
        try {
            await processQueueItem(idx, { current: n + 1, total: pendingIndexes.length });
            processedCount++;
        } catch (err) {
            console.error("Bulk video processing failed:", err);
            const item = activeQueue[idx];
            if (err.creditsExhausted) {
                item.status = "ready";
                showError(`Daily credit limit reached after ${processedCount} video(s). Upgrade to Premium for unlimited processing.`);
                break;
            }
            item.status = "error";
            item.error = err.message || "Processing failed.";
            failedCount++;
        }
    }

    isBulkProcessing = false;
    progressPanel.style.display = "none";
    disableControlsDuringProcessing(false);

    if (processedCount > 0) {
        // Hide download all button initially until ad is cleared
        downloadAllBtn.style.display = "none";
        
        showInterstitialAdGate(() => {
            renderQueueList();
            updateCreditsUI();
            
            // Show below-result ad, hide below-upload
            document.getElementById("ad-below-upload-wrapper").style.display = "none";
            document.getElementById("ad-below-result-wrapper").style.display = "flex";
            loadAdsterraAd("ad-below-result-container", ADSTERRA_CONFIG.placements.belowResult, 300, 250);
            
            showTemporaryAlert(`Bulk processing finished: ${processedCount} cleaned${failedCount ? `, ${failedCount} failed` : ""}.`);
        });
    } else {
        renderQueueList();
        updateCreditsUI();
    }
}

function disableControlsDuringProcessing(disable) {
    chooseVideoBtn.disabled = disable;
    processVideoBtn.disabled = disable;
    processAllBtn.disabled = disable;
    downloadAllBtn.disabled = disable;
    clearQueueBtn.disabled = disable;
    loginBtn.disabled = disable;
    upgradeBtn.disabled = disable;
}

function downloadQueueItem(item) {
    if (!item.outputUrl) return;

    const originalName = item.file.name;
    const cleanedName = originalName.replace(/\.[^/.]+$/, "") + "-cleaned.mp4";

    const link = document.createElement("a");
    link.href = item.outputUrl;
    link.download = cleanedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function triggerDownload() {
    if (activeVideoIndex === -1) return;
    downloadQueueItem(activeQueue[activeVideoIndex]);
}

// Downloads every cleaned video in the queue
async function downloadAllVideos() {
    const doneItems = activeQueue.filter(item => item.status === "done" && item.outputUrl);
    for (const item of doneItems) {
        downloadQueueItem(item);
        // Small delay so browsers don't drop successive downloads
        await new Promise(r => setTimeout(r, 350));
    }
}

// Mock auth login trigger
function triggerLoginToggle(e) {
    if (e) e.preventDefault();
    isLoggedIn = !isLoggedIn;

    if (isLoggedIn) {
        loginBtn.innerText = "Logout";
        mockAvatar.style.background = "var(--primary-gradient)";
        mockAvatar.style.border = "1.5px solid #c084fc";

        // Show mock toast
        showTemporaryAlert("Successfully signed in! Daily limits increased to 6.");
    } else {
        loginBtn.innerText = "Login";
        mockAvatar.style.background = "rgba(255, 255, 255, 0.05)";
        mockAvatar.style.border = "1px solid var(--border-card)";

        isPremium = false; // Reset premium on logout
    }

    updateCreditsUI();
    updateProcessButtonState();
}

// Premium Upgrade trigger
function triggerUpgrade(e) {
    if (e) e.preventDefault();
    isPremium = true;
    showTemporaryAlert("👑 Premium Activated! Unlimited local rendering unlocked.");

    // Enable multi-select file chooser
    chooseBtnText.innerText = "Add Videos";
    fileInput.multiple = true;

    updateCreditsUI();
    updateProcessButtonState();
    renderQueueList();
}

function showTemporaryAlert(msg) {
    const alertDiv = document.createElement("div");
    alertDiv.style.position = "fixed";
    alertDiv.style.bottom = "2rem";
    alertDiv.style.right = "2rem";
    alertDiv.style.zIndex = "1000";
    alertDiv.style.background = "var(--bg-secondary)";
    alertDiv.style.border = "1px solid var(--primary)";
    alertDiv.style.padding = "1rem 1.5rem";
    alertDiv.style.borderRadius = "0.5rem";
    alertDiv.style.boxShadow = "var(--card-shadow)";
    alertDiv.style.color = "var(--text-primary)";
    alertDiv.style.fontSize = "0.85rem";
    alertDiv.style.fontWeight = "700";
    alertDiv.style.display = "flex";
    alertDiv.style.alignItems = "center";
    alertDiv.style.gap = "0.75rem";
    alertDiv.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
            <polygon points="12 2 2 22 22 22"></polygon>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>${msg}</span>
    `;

    document.body.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.style.opacity = "0";
        alertDiv.style.transition = "opacity 0.5s ease";
        setTimeout(() => alertDiv.remove(), 500);
    }, 3000);
}

// Binds Play button on demonstration preview to swap for iframe video
function setupDemoPlayer() {
    demoVideoWrapper.addEventListener("click", () => {
        demoVideoWrapper.innerHTML = `
            <iframe 
                src="https://www.youtube.com/embed/8x5TfVX214I?autoplay=1&rel=0" 
                title="Gemini Omni Video Watermark Remover Guide" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen 
                class="video-frame" 
                style="width: 100%; height: 100%; border: none;">
            </iframe>
        `;
    });
}

// Image State Variables
let imageQueue = []; // { id, file, canvas, status, error }
let activeImageIndex = -1;
let isBulkImageProcessing = false;
let imgStudioMode = "auto"; // auto, manual
let isDrawing = false;
let strokesHistory = [];
let maxStrokes = 20;
let lastX = 0;
let lastY = 0;

function getActiveImageItem() {
    return activeImageIndex >= 0 ? imageQueue[activeImageIndex] : null;
}

// Image DOM Elements
const tabVideoCleaner = document.getElementById("tab-video-cleaner");
const tabImageCleaner = document.getElementById("tab-image-cleaner");
const videoStudioPanel = document.getElementById("video-studio-panel");
const imageStudioPanel = document.getElementById("image-studio-panel");

const imgSubtabAuto = document.getElementById("img-subtab-auto");
const imgSubtabManual = document.getElementById("img-subtab-manual");
const imageDropzone = document.getElementById("image-dropzone");
const imageFileInput = document.getElementById("image-file-input");
const imageEditorWorkspace = document.getElementById("image-editor-workspace");

const imageCanvas = document.getElementById("image-canvas");
const imageMaskCanvas = document.getElementById("image-mask-canvas");
const brushCursor = document.getElementById("brush-cursor");
const canvasLayersWrapper = document.getElementById("canvas-layers-wrapper");

const imageNameText = document.getElementById("image-name-text");
const imageDimsText = document.getElementById("image-dims-text");
const brushSettingsCard = document.getElementById("brush-settings-card");
const brushSizeSlider = document.getElementById("brush-size-slider");
const brushSizeVal = document.getElementById("brush-size-val");
const btnUndoDraw = document.getElementById("btn-undo-draw");
const btnClearMask = document.getElementById("btn-clear-mask");

const imageSuccessAlert = document.getElementById("image-success-alert");
const imageStatusText = document.getElementById("image-status-text");
const imageErrorAlert = document.getElementById("image-error-alert");
const imageErrorMsg = document.getElementById("image-error-msg");
const imageProgressPanel = document.getElementById("image-progress-panel");
const imageProgressText = document.getElementById("image-progress-text");
const imageQueueContainer = document.getElementById("image-queue-container");

const chooseImageBtn = document.getElementById("choose-image-btn");
const processImageBtn = document.getElementById("process-image-btn");
const processAllImagesBtn = document.getElementById("process-all-images-btn");
const downloadImageBtn = document.getElementById("download-image-btn");
const downloadAllImagesBtn = document.getElementById("download-all-images-btn");
const clearImageBtn = document.getElementById("clear-image-btn");

function setupEventListeners() {
    // Main Studio switch tabs
    tabVideoCleaner.addEventListener("click", () => switchStudio("video"));
    tabImageCleaner.addEventListener("click", () => switchStudio("image"));

    // Video events
    if (navGeminiVideo) {
        navGeminiVideo.addEventListener("click", (e) => {
            e.preventDefault();
            switchStudio("video");
        });
    }

    // Zoom modal events
    if (zoomVideoBtn) {
        zoomVideoBtn.addEventListener("click", () => {
            if (!destVideo || !destVideo.src) return;
            zoomVideo.src = destVideo.src;
            zoomModal.style.display = "flex";
            zoomVideo.play().catch(err => console.log("Zoom autoplay prevented:", err));
        });
    }

    const closeZoomModal = () => {
        zoomModal.style.display = "none";
        zoomVideo.pause();
        zoomVideo.src = "";
    };

    if (zoomModalClose) {
        zoomModalClose.addEventListener("click", closeZoomModal);
    }
    if (zoomModalBackdrop) {
        zoomModalBackdrop.addEventListener("click", closeZoomModal);
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && zoomModal.style.display === "flex") {
            closeZoomModal();
        }
    });

    chooseVideoBtn.addEventListener("click", () => fileInput.click());
    processVideoBtn.addEventListener("click", triggerVideoProcessing);
    processAllBtn.addEventListener("click", triggerBulkVideoProcessing);
    downloadVideoBtn.addEventListener("click", triggerDownload);
    downloadAllBtn.addEventListener("click", downloadAllVideos);
    clearQueueBtn.addEventListener("click", () => {
        activeQueue.forEach(item => {
            if (item.sourceUrl) URL.revokeObjectURL(item.sourceUrl);
            if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
        });
        resetToEmptyState();
    });

    // Image events
    chooseImageBtn.addEventListener("click", () => imageFileInput.click());
    imgSubtabAuto.addEventListener("click", () => switchImageMode("auto"));
    imgSubtabManual.addEventListener("click", () => switchImageMode("manual"));
    imageFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleSelectedImages(e.target.files);
        }
    });

    // Image Drag & Drop
    setupImageDropzone();

    // Brush Settings
    brushSizeSlider.addEventListener("input", (e) => {
        brushSizeVal.innerText = `${e.target.value}px`;
    });
    btnUndoDraw.addEventListener("click", undoDrawStroke);
    btnClearMask.addEventListener("click", clearDrawingMask);

    // Image Actions
    processImageBtn.addEventListener("click", triggerImageProcessing);
    processAllImagesBtn.addEventListener("click", triggerBulkImageProcessing);
    downloadImageBtn.addEventListener("click", triggerImageDownload);
    downloadAllImagesBtn.addEventListener("click", downloadAllImages);
    clearImageBtn.addEventListener("click", resetImageState);

    // Canvas drawing events
    setupDrawingCanvas();

    // Common Auth Events
    loginBtn.addEventListener("click", triggerLoginToggle);
    upgradeBtn.addEventListener("click", triggerUpgrade);
    setupDemoPlayer();

    contactBtn.addEventListener("click", () => {
        showTemporaryAlert("Contact system offline. Demo app only.");
    });

    // Video opacity mode buttons
    opacityAutoBtn.addEventListener("click", () => setVideoOpacityMode("auto"));
    opacitySoftBtn.addEventListener("click", () => setVideoOpacityMode("soft"));
    opacityNormalBtn.addEventListener("click", () => setVideoOpacityMode("normal"));

    // Image opacity mode buttons
    imgOpacityAutoBtn.addEventListener("click", () => setImageOpacityMode("auto"));
    imgOpacitySoftBtn.addEventListener("click", () => setImageOpacityMode("soft"));
    imgOpacityNormalBtn.addEventListener("click", () => setImageOpacityMode("normal"));
}

function setVideoOpacityMode(mode) {
    videoOpacityMode = mode;
    opacityAutoBtn.classList.toggle("active", mode === "auto");
    opacitySoftBtn.classList.toggle("active", mode === "soft");
    opacityNormalBtn.classList.toggle("active", mode === "normal");
}

function setImageOpacityMode(mode) {
    imageOpacityMode = mode;
    imgOpacityAutoBtn.classList.toggle("active", mode === "auto");
    imgOpacitySoftBtn.classList.toggle("active", mode === "soft");
    imgOpacityNormalBtn.classList.toggle("active", mode === "normal");
}

function switchStudio(type) {
    if (type === "video") {
        tabVideoCleaner.classList.add("active");
        tabImageCleaner.classList.remove("active");
        videoStudioPanel.style.display = "block";
        imageStudioPanel.style.display = "none";
    } else {
        tabVideoCleaner.classList.remove("active");
        tabImageCleaner.classList.add("active");
        videoStudioPanel.style.display = "none";
        imageStudioPanel.style.display = "block";
    }
}

// switchVideoMode is deprecated as Veo mode has been removed

function switchImageMode(mode) {
    imgStudioMode = mode;
    if (mode === "auto") {
        imgSubtabAuto.classList.add("active");
        imgSubtabManual.classList.remove("active");
        brushSettingsCard.style.display = "none";
        imageMaskCanvas.style.display = "none";
        brushCursor.style.display = "none";
    } else {
        imgSubtabAuto.classList.remove("active");
        imgSubtabManual.classList.add("active");
        brushSettingsCard.style.display = "block";
        imageMaskCanvas.style.display = "block";
        if (getActiveImageItem()) {
            resizeMaskCanvas();
        }
    }
    updateProcessImageButtonState();
}

function setupImageDropzone() {
    imageDropzone.addEventListener("click", () => imageFileInput.click());

    imageDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        imageDropzone.style.borderColor = "var(--primary)";
        imageDropzone.style.background = "rgba(138, 43, 226, 0.05)";
    });

    imageDropzone.addEventListener("dragleave", () => {
        imageDropzone.style.borderColor = "rgba(255, 255, 255, 0.15)";
        imageDropzone.style.background = "transparent";
    });

    imageDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        imageDropzone.style.borderColor = "rgba(255, 255, 255, 0.15)";
        imageDropzone.style.background = "transparent";

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleSelectedImages(e.dataTransfer.files);
        }
    });
}

// Loads one or more image files into the bulk queue (up to 20)
async function handleSelectedImages(files) {
    imageErrorAlert.style.display = "none";
    imageSuccessAlert.style.display = "none";

    const filtered = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (filtered.length === 0) {
        showImageError("Please upload valid image files (PNG, JPG, or WebP).");
        return;
    }

    const spaceLeft = MAX_IMAGE_QUEUE_SIZE - imageQueue.length;
    if (spaceLeft <= 0) {
        showImageError(`Queue limit of ${MAX_IMAGE_QUEUE_SIZE} images reached. Process or clear some images first.`);
        return;
    }
    if (filtered.length > spaceLeft) {
        showImageError(`Only ${spaceLeft} more image(s) can be added (max ${MAX_IMAGE_QUEUE_SIZE} at a time). Extra files were skipped.`);
    }

    const toLoad = filtered.slice(0, spaceLeft);
    let loadedAny = false;

    for (const file of toLoad) {
        try {
            const canvas = await loadImageToCanvas(file);
            imageQueue.push({
                id: crypto.randomUUID(),
                file,
                canvas,
                status: "ready", // ready, processing, done, error
                error: null
            });
            loadedAny = true;
        } catch (e) {
            showImageError(`Failed to load "${file.name}". Make sure it is a valid image.`);
        }
    }

    if (loadedAny) {
        if (activeImageIndex === -1) {
            selectImageItem(0);
        } else {
            renderImageQueueList();
        }
        imageSuccessAlert.style.display = "flex";
        imageStatusText.innerText = `${imageQueue.length} image(s) in queue.`;
        updateProcessImageButtonState();
    }

    imageFileInput.value = "";
}

// Decodes an image file into a full-resolution offscreen canvas
function loadImageToCanvas(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Image load failed"));
        };
        img.src = url;
    });
}

// Shows the given queue image in the main editor canvas
function selectImageItem(index) {
    if (index < 0 || index >= imageQueue.length) return;
    activeImageIndex = index;
    const item = imageQueue[index];

    imageCanvas.width = item.canvas.width;
    imageCanvas.height = item.canvas.height;
    imageCanvas.getContext("2d").drawImage(item.canvas, 0, 0);

    imageNameText.innerText = item.file.name;
    imageDimsText.innerText = `${item.canvas.width} x ${item.canvas.height} | ${(item.file.size / (1024 * 1024)).toFixed(2)} MB`;

    imageDropzone.style.display = "none";
    imageEditorWorkspace.style.display = "flex";
    clearImageBtn.style.display = "inline-flex";
    downloadImageBtn.style.display = item.status === "done" ? "inline-flex" : "none";

    if (imgStudioMode === "manual") {
        resizeMaskCanvas();
    }

    if (item.status === "error" && item.error) {
        showImageError(item.error);
    } else {
        imageErrorAlert.style.display = "none";
    }

    renderImageQueueList();
    updateProcessImageButtonState();
}

function renderImageQueueList() {
    if (imageQueue.length === 0) {
        imageQueueContainer.style.display = "none";
        updateImageBulkControls();
        return;
    }

    imageQueueContainer.innerHTML = "";
    imageQueueContainer.style.display = "flex";

    imageQueue.forEach((item, index) => {
        const qItem = document.createElement("button");
        qItem.className = `queue-item ${index === activeImageIndex ? 'active' : ''}`;
        qItem.type = "button";
        qItem.addEventListener("click", () => selectImageItem(index));

        const detailBox = document.createElement("div");
        detailBox.className = "queue-details";

        const nameSpan = document.createElement("span");
        nameSpan.className = "queue-name";
        nameSpan.innerText = `${index + 1}. ${item.file.name}`;

        const statusSpan = document.createElement("span");
        statusSpan.className = `queue-status status-${item.status}`;

        if (item.status === "processing") {
            statusSpan.innerText = "Processing...";
        } else if (item.status === "done") {
            statusSpan.innerText = "✓ Done";
        } else if (item.status === "error") {
            statusSpan.innerText = "✕ Failed";
        } else {
            statusSpan.innerText = "Ready";
        }

        detailBox.appendChild(nameSpan);
        detailBox.appendChild(statusSpan);
        qItem.appendChild(detailBox);

        if (item.status === "done") {
            const dlBtn = document.createElement("button");
            dlBtn.className = "queue-dl-btn";
            dlBtn.title = "Download cleaned PNG";
            dlBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            `;
            dlBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                downloadImageItem(item);
            });
            qItem.appendChild(dlBtn);
        }

        const removeBtn = document.createElement("button");
        removeBtn.className = "queue-remove-btn";
        removeBtn.title = "Remove from queue";
        removeBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
        `;
        removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            removeImageQueueItem(index);
        });

        qItem.appendChild(removeBtn);
        imageQueueContainer.appendChild(qItem);
    });

    updateImageBulkControls();
}

function updateImageBulkControls() {
    const pendingCount = imageQueue.filter(i => i.status === "ready" || i.status === "error").length;
    const doneCount = imageQueue.filter(i => i.status === "done").length;

    if (pendingCount > 1 && !isBulkImageProcessing) {
        processAllImagesBtn.style.display = "inline-flex";
        document.getElementById("process-all-images-btn-text").innerText = `Auto Clean All (${pendingCount})`;
    } else if (!isBulkImageProcessing) {
        processAllImagesBtn.style.display = "none";
    }

    if (doneCount > 1) {
        downloadAllImagesBtn.style.display = "inline-flex";
        document.getElementById("download-all-images-btn-text").innerText = `Download All (${doneCount})`;
    } else {
        downloadAllImagesBtn.style.display = "none";
    }
}

function removeImageQueueItem(index) {
    const item = imageQueue[index];
    if (isBulkImageProcessing || (item && item.status === "processing")) return;

    imageQueue.splice(index, 1);

    if (imageQueue.length === 0) {
        resetImageState();
        return;
    }

    if (index === activeImageIndex) {
        selectImageItem(Math.max(0, index - 1));
    } else {
        if (index < activeImageIndex) activeImageIndex--;
        renderImageQueueList();
    }
}

function resizeMaskCanvas() {
    if (!imageCanvas.width || !imageCanvas.height) return;
    imageMaskCanvas.width = imageCanvas.width;
    imageMaskCanvas.height = imageCanvas.height;
    clearDrawingMask();
    strokesHistory = [];
}

function updateProcessImageButtonState() {
    const item = getActiveImageItem();
    if (!item || isBulkImageProcessing || item.status === "processing") {
        processImageBtn.disabled = true;
        return;
    }
    
    // Check credits
    if (!isPremium) {
        const remaining = isLoggedIn ? 6 - getUsedCreditsCount() : 3 - getUsedCreditsCount();
        if (remaining <= 0) {
            processImageBtn.disabled = true;
            return;
        }
    }

    processImageBtn.disabled = false;
}

function showImageError(msg) {
    imageErrorMsg.innerText = msg;
    imageErrorAlert.style.display = "flex";
    imageSuccessAlert.style.display = "none";
}

function getCanvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function setupDrawingCanvas() {
    const drawStart = (e) => {
        if (!getActiveImageItem() || imgStudioMode !== "manual") return;
        e.preventDefault();
        
        isDrawing = true;
        const coords = getCanvasCoords(e, imageMaskCanvas);
        lastX = coords.x;
        lastY = coords.y;

        // Push state for undo
        saveStrokeState();

        drawDot(coords.x, coords.y);
    };

    const drawMove = (e) => {
        if (!getActiveImageItem() || imgStudioMode !== "manual") return;
        
        const coords = getCanvasCoords(e, imageMaskCanvas);

        // Position custom brush indicator
        const rect = imageMaskCanvas.getBoundingClientRect();
        let clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const brushSizeVal = parseInt(brushSizeSlider.value);
        const cssBrushWidth = brushSizeVal * (rect.width / imageMaskCanvas.width);
        
        brushCursor.style.width = `${cssBrushWidth}px`;
        brushCursor.style.height = `${cssBrushWidth}px`;
        
        const parentRect = canvasLayersWrapper.getBoundingClientRect();
        brushCursor.style.left = `${clientX - parentRect.left}px`;
        brushCursor.style.top = `${clientY - parentRect.top}px`;
        brushCursor.style.display = "block";

        if (!isDrawing) return;
        e.preventDefault();

        drawLine(lastX, lastY, coords.x, coords.y);
        lastX = coords.x;
        lastY = coords.y;
    };

    const drawEnd = () => {
        isDrawing = false;
        brushCursor.style.display = "none";
    };

    // Events for mouse
    imageMaskCanvas.addEventListener("mousedown", drawStart);
    imageMaskCanvas.addEventListener("mousemove", drawMove);
    imageMaskCanvas.addEventListener("mouseup", drawEnd);
    imageMaskCanvas.addEventListener("mouseleave", drawEnd);

    // Events for touch
    imageMaskCanvas.addEventListener("touchstart", drawStart, { passive: false });
    imageMaskCanvas.addEventListener("touchmove", drawMove, { passive: false });
    imageMaskCanvas.addEventListener("touchend", drawEnd);
    
    // Manage brush cursor mouseenter/mouseleave
    imageMaskCanvas.addEventListener("mouseenter", () => {
        if (getActiveImageItem() && imgStudioMode === "manual") {
            brushCursor.style.display = "block";
        }
    });
}

function saveStrokeState() {
    const ctx = imageMaskCanvas.getContext("2d");
    const state = ctx.getImageData(0, 0, imageMaskCanvas.width, imageMaskCanvas.height);
    strokesHistory.push(state);
    if (strokesHistory.length > maxStrokes) {
        strokesHistory.shift();
    }
}

function undoDrawStroke() {
    if (strokesHistory.length === 0) return;
    const ctx = imageMaskCanvas.getContext("2d");
    const lastState = strokesHistory.pop();
    ctx.putImageData(lastState, 0, 0);
}

function clearDrawingMask() {
    const ctx = imageMaskCanvas.getContext("2d");
    ctx.clearRect(0, 0, imageMaskCanvas.width, imageMaskCanvas.height);
}

function drawDot(x, y) {
    const ctx = imageMaskCanvas.getContext("2d");
    const size = parseInt(brushSizeSlider.value);
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
    ctx.fill();
}

function drawLine(x1, y1, x2, y2) {
    const ctx = imageMaskCanvas.getContext("2d");
    const size = parseInt(brushSizeSlider.value);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
    ctx.stroke();
}

// Auto-cleans one queued image on its own canvas (used by single & bulk flows)
async function processImageItem(index, bulkInfo) {
    const item = imageQueue[index];

    ensureCreditsAvailable();

    item.status = "processing";
    item.error = null;
    renderImageQueueList();
    updateProcessImageButtonState();

    // Allow UI thread to update
    await new Promise(r => setTimeout(r, 30));

    const detectedWatermark = await cleanImageWatermarkAuto(item.canvas, null, imageOpacityMode);
    if (detectedWatermark) {
        console.log("Watermark auto-cleaned at location:", detectedWatermark.x, detectedWatermark.y);
    }

    if (bulkInfo) {
        item.status = "done";
        incrementCreditsUsage();
        if (index === activeImageIndex) {
            imageCanvas.getContext("2d").drawImage(item.canvas, 0, 0);
        }
        renderImageQueueList();
        return Promise.resolve();
    } else {
        return new Promise((resolve) => {
            showInterstitialAdGate(() => {
                item.status = "done";
                incrementCreditsUsage();
                if (index === activeImageIndex) {
                    imageCanvas.getContext("2d").drawImage(item.canvas, 0, 0);
                    downloadImageBtn.style.display = "inline-flex";
                    
                    // Show below-result ad, hide below-upload
                    document.getElementById("ad-below-upload-wrapper").style.display = "none";
                    document.getElementById("ad-below-result-wrapper").style.display = "flex";
                    loadAdsterraAd("ad-below-result-container", ADSTERRA_CONFIG.placements.belowResult, 300, 250);
                }
                renderImageQueueList();
                resolve();
            });
        });
    }
}

// Processes the currently selected image (auto or manual mode)
async function triggerImageProcessing() {
    const item = getActiveImageItem();
    if (!item || isBulkImageProcessing || item.status === "processing") return;
    
    // Check agree checkbox
    if (!imgAgreeCheckbox.checked) {
        showImageError("Please confirm that you own this media or have permission to edit it.");
        return;
    }

    try {
        imageSuccessAlert.style.display = "none";
        imageErrorAlert.style.display = "none";
        imageProgressPanel.style.display = "flex";
        imageProgressText.innerText = "Cleaning Watermark...";
        disableImageControls(true);

        // Allow UI thread to update
        await new Promise(r => setTimeout(r, 100));

        if (imgStudioMode === "auto") {
            await processImageItem(activeImageIndex);
            imageProgressPanel.style.display = "none";
            imageSuccessAlert.style.display = "flex";
            imageStatusText.innerText = "Watermark cleaned successfully!";
            disableImageControls(false);
            updateCreditsUI();
            updateProcessImageButtonState();
        } else {
            ensureCreditsAvailable();

            item.status = "processing";
            item.error = null;
            renderImageQueueList();
            await new Promise(r => setTimeout(r, 30));

            cleanImageWatermarkManual(item.canvas, imageMaskCanvas, null);
            clearDrawingMask();
            
            imageProgressPanel.style.display = "none";
            disableImageControls(false);

            showInterstitialAdGate(() => {
                item.status = "done";
                incrementCreditsUsage();

                imageCanvas.getContext("2d").drawImage(item.canvas, 0, 0);
                downloadImageBtn.style.display = "inline-flex";
                
                // Show below-result ad, hide below-upload
                document.getElementById("ad-below-upload-wrapper").style.display = "none";
                document.getElementById("ad-below-result-wrapper").style.display = "flex";
                loadAdsterraAd("ad-below-result-container", ADSTERRA_CONFIG.placements.belowResult, 300, 250);
                
                renderImageQueueList();
                imageSuccessAlert.style.display = "flex";
                imageStatusText.innerText = "Watermark cleaned successfully!";
                updateCreditsUI();
                updateProcessImageButtonState();
            });
        }
    } catch (err) {
        console.error("Image processing failed:", err);
        item.status = err.creditsExhausted ? "ready" : "error";
        item.error = err.message || "Failed to process image.";
        showImageError(item.error);
        imageProgressPanel.style.display = "none";
        disableImageControls(false);
        renderImageQueueList();
        updateProcessImageButtonState();
    }
}

// Bulk: auto-cleans every pending image in the queue sequentially (up to 20)
async function triggerBulkImageProcessing() {
    if (isBulkImageProcessing) return;

    // Check agree checkbox
    if (!imgAgreeCheckbox.checked) {
        showImageError("Please confirm that you own this media or have permission to edit it.");
        return;
    }

    const pendingIndexes = imageQueue
        .map((item, i) => (item.status === "ready" || item.status === "error") ? i : -1)
        .filter(i => i !== -1);

    if (pendingIndexes.length === 0) return;

    isBulkImageProcessing = true;
    imageSuccessAlert.style.display = "none";
    imageErrorAlert.style.display = "none";
    imageProgressPanel.style.display = "flex";
    disableImageControls(true);

    let processedCount = 0;
    let failedCount = 0;

    for (let n = 0; n < pendingIndexes.length; n++) {
        const idx = pendingIndexes[n];
        imageProgressText.innerText = `Cleaning image ${n + 1}/${pendingIndexes.length}...`;
        try {
            await processImageItem(idx, true);
            processedCount++;
        } catch (err) {
            console.error("Bulk image processing failed:", err);
            const item = imageQueue[idx];
            if (err.creditsExhausted) {
                item.status = "ready";
                showImageError(`Daily credit limit reached after ${processedCount} image(s). Upgrade to Premium for unlimited processing.`);
                break;
            }
            item.status = "error";
            item.error = err.message || "Processing failed.";
            failedCount++;
        }
    }

    isBulkImageProcessing = false;
    imageProgressPanel.style.display = "none";
    disableImageControls(false);

    if (processedCount > 0) {
        // Hide download all button initially until ad is cleared
        downloadAllImagesBtn.style.display = "none";
        
        showInterstitialAdGate(() => {
            renderImageQueueList();
            updateCreditsUI();
            updateProcessImageButtonState();
            
            // Show below-result ad, hide below-upload
            document.getElementById("ad-below-upload-wrapper").style.display = "none";
            document.getElementById("ad-below-result-wrapper").style.display = "flex";
            loadAdsterraAd("ad-below-result-container", ADSTERRA_CONFIG.placements.belowResult, 300, 250);
            
            imageSuccessAlert.style.display = "flex";
            imageStatusText.innerText = `Bulk cleaning finished: ${processedCount} cleaned${failedCount ? `, ${failedCount} failed` : ""}.`;
        });
    } else {
        renderImageQueueList();
        updateCreditsUI();
        updateProcessImageButtonState();
    }
}

function disableImageControls(disable) {
    chooseImageBtn.disabled = disable;
    processImageBtn.disabled = disable;
    processAllImagesBtn.disabled = disable;
    downloadAllImagesBtn.disabled = disable;
    clearImageBtn.disabled = disable;
    btnUndoDraw.disabled = disable;
    btnClearMask.disabled = disable;
}

function downloadImageItem(item) {
    const cleanedName = item.file.name.replace(/\.[^/.]+$/, "") + "-cleaned.png";
    const dataUrl = item.canvas.toDataURL("image/png");
    
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = cleanedName;
    link.click();
}

function triggerImageDownload() {
    const item = getActiveImageItem();
    if (!item) return;
    downloadImageItem(item);
}

// Downloads every cleaned image in the queue
async function downloadAllImages() {
    const doneItems = imageQueue.filter(item => item.status === "done");
    for (const item of doneItems) {
        downloadImageItem(item);
        // Small delay so browsers don't drop successive downloads
        await new Promise(r => setTimeout(r, 350));
    }
}

function resetImageState() {
    imageQueue = [];
    activeImageIndex = -1;
    strokesHistory = [];
    
    imageDropzone.style.display = "flex";
    imageEditorWorkspace.style.display = "none";
    imageSuccessAlert.style.display = "none";
    imageErrorAlert.style.display = "none";
    downloadImageBtn.style.display = "none";
    downloadAllImagesBtn.style.display = "none";
    processAllImagesBtn.style.display = "none";
    clearImageBtn.style.display = "none";
    imageQueueContainer.style.display = "none";
    imageQueueContainer.innerHTML = "";
    
    imageFileInput.value = "";
    
    // Clear canvases
    const ctx = imageCanvas.getContext("2d");
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    clearDrawingMask();

    updateCreditsUI();
}

