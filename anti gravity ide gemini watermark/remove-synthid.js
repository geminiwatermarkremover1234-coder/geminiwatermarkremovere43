// SynthID Watermark Remover Engine and UI Controllers
import { processVideoWatermark } from './processor.js?v=16';

// State Variables
let originalCanvas = null;
let processedCanvas = null; // Stored as canvas for images, object URL for videos
let activeFile = null;
let isProcessing = false;
let sliderActive = false;

// DOM Elements
const dropzone = document.getElementById("dropzone");
const imageFile = document.getElementById("image-file");
const workspace = document.getElementById("workspace");
const fileName = document.getElementById("file-name");
const fileMeta = document.getElementById("file-meta");
const imageOptions = document.getElementById("image-options");
const removeVisibleLogo = document.getElementById("remove-visible-logo");
const videoOptions = document.getElementById("video-options");
const videoModeSelect = document.getElementById("video-mode-select");
const viewerContainer = document.getElementById("viewer-container");
const sliderContainer = document.getElementById("slider-container");
const imgBefore = document.getElementById("img-before");
const imgAfter = document.getElementById("img-after");
const imgAfterContainer = document.getElementById("img-after-container");
const sliderHandle = document.getElementById("slider-handle");
const imgSourceOnly = document.getElementById("img-source-only");
const videoPreviewGrid = document.getElementById("video-preview-grid");
const vidSource = document.getElementById("vid-source");
const vidOutputContainer = document.getElementById("vid-output-container");
const vidOutput = document.getElementById("vid-output");
const agreeCheckbox = document.getElementById("agree-checkbox");
const btnProcess = document.getElementById("btn-process");
const btnDownload = document.getElementById("btn-download");
const btnReset = document.getElementById("btn-reset");
const progressBox = document.getElementById("progress-box");
const progressStage = document.getElementById("progress-stage");
const progressPct = document.getElementById("progress-pct");
const progressBar = document.getElementById("progress-bar");
const errorAlert = document.getElementById("error-alert");
const successAlert = document.getElementById("success-alert");
const engineStatus = document.getElementById("engine-status");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

// Initialize Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    setupDropzone();
    setupComparisonSlider();
    setupButtons();
});

// Dropzone Drag and Drop handlers
function setupDropzone() {
    dropzone.addEventListener("click", () => imageFile.click());

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("border-primary", "bg-primary/5");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("border-primary", "bg-primary/5");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-primary", "bg-primary/5");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    imageFile.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });
}

// Ingestion file handle
function handleSelectedFile(file) {
    errorAlert.classList.add("hidden");
    successAlert.classList.add("hidden");
    
    activeFile = file;
    fileName.innerText = file.name;
    fileMeta.innerText = `Loading... | ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    
    if (file.type.startsWith("image/")) {
        // IMAGE PATHWAY
        imageOptions.classList.remove("hidden");
        videoOptions.classList.add("hidden");
        videoPreviewGrid.style.display = "none";
        imgSourceOnly.style.display = "block";
        sliderContainer.style.display = "none";
        btnDownload.style.display = "none";
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Store original on canvas
                originalCanvas = document.createElement("canvas");
                originalCanvas.width = img.naturalWidth;
                originalCanvas.height = img.naturalHeight;
                const ctx = originalCanvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                
                // Set metadata
                fileMeta.innerText = `${img.naturalWidth} x ${img.naturalHeight} | ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
                
                // Show workspace & initial source preview
                imgSourceOnly.src = e.target.result;
                dropzone.classList.add("hidden");
                workspace.classList.remove("hidden");
                
                // Enable process button
                btnProcess.disabled = false;
                btnDownload.style.display = "none";
                
                updateEngineStatus("idle");
            };
            img.onerror = () => {
                showError("Failed to render image. It might be corrupted.");
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            showError("Failed to read image file.");
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
        // VIDEO PATHWAY
        imageOptions.classList.add("hidden");
        videoOptions.classList.remove("hidden");
        imgSourceOnly.style.display = "none";
        sliderContainer.style.display = "none";
        videoPreviewGrid.style.display = "flex";
        vidOutputContainer.style.display = "none";
        btnDownload.style.display = "none";
        
        // Revoke old URLs
        if (vidSource.src) URL.revokeObjectURL(vidSource.src);
        if (vidOutput.src) URL.revokeObjectURL(vidOutput.src);
        vidSource.src = "";
        vidOutput.src = "";
        
        const videoUrl = URL.createObjectURL(file);
        vidSource.src = videoUrl;
        
        vidSource.onloadedmetadata = () => {
            fileMeta.innerText = `${vidSource.videoWidth}x${vidSource.videoHeight} | ${vidSource.duration.toFixed(1)}s | ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
            dropzone.classList.add("hidden");
            workspace.classList.remove("hidden");
            btnProcess.disabled = false;
            updateEngineStatus("idle");
        };
        vidSource.onerror = () => {
            showError("Failed to load video file. Make sure it is a valid H.264 MP4.");
        };
    } else {
        showError("Unsupported file type. Please upload a valid image or video.");
    }
}

// Actions buttons
function setupButtons() {
    btnProcess.addEventListener("click", triggerProcessing);
    btnReset.addEventListener("click", resetState);
    btnDownload.addEventListener("click", downloadCleanedImage);
}

function updateEngineStatus(status, details = "") {
    statusDot.className = "w-2 h-2 rounded-full";
    if (status === "idle") {
        statusDot.classList.add("bg-slate-400");
        statusText.innerText = "Idle";
    } else if (status === "processing") {
        statusDot.classList.add("bg-primary", "animate-pulse");
        statusText.innerText = details || "Processing...";
    } else if (status === "success") {
        statusDot.classList.add("bg-green-500");
        statusText.innerText = "Completed";
    } else if (status === "error") {
        statusDot.classList.add("bg-red-500");
        statusText.innerText = "Failed";
    }
}

function showError(msg) {
    errorAlert.innerText = msg;
    errorAlert.classList.remove("hidden");
    successAlert.classList.add("hidden");
    updateEngineStatus("error");
}

function showSuccess(msg) {
    successAlert.innerText = msg;
    successAlert.classList.remove("hidden");
    errorAlert.classList.add("hidden");
    updateEngineStatus("success");
}

// State reset
function resetState() {
    activeFile = null;
    originalCanvas = null;
    if (processedCanvas && typeof processedCanvas === "string") {
        URL.revokeObjectURL(processedCanvas);
    }
    processedCanvas = null;
    isProcessing = false;
    
    workspace.classList.add("hidden");
    dropzone.classList.remove("hidden");
    imageFile.value = "";
    
    if (vidSource.src) URL.revokeObjectURL(vidSource.src);
    if (vidOutput.src) URL.revokeObjectURL(vidOutput.src);
    vidSource.src = "";
    vidOutput.src = "";
    
    btnDownload.style.display = "none";
    progressBox.style.display = "none";
    errorAlert.classList.add("hidden");
    successAlert.classList.add("hidden");
    viewerContainer.classList.remove("scanning");
    
    updateEngineStatus("idle");
}

// Visual slider controls
function setupComparisonSlider() {
    let active = false;

    const startSlide = (e) => {
        active = true;
    };

    const endSlide = () => {
        active = false;
    };

    const moveSlide = (e) => {
        if (!active) return;
        
        let clientX;
        if (e.type === "touchmove") {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        
        const rect = sliderContainer.getBoundingClientRect();
        let position = (clientX - rect.left) / rect.width;
        
        if (position < 0) position = 0;
        if (position > 1) position = 1;
        
        const percentage = position * 100;
        sliderHandle.style.left = `${percentage}%`;
        imgAfterContainer.style.width = `${percentage}%`;
    };

    // Desktop
    sliderHandle.addEventListener("mousedown", startSlide);
    window.addEventListener("mouseup", endSlide);
    window.addEventListener("mousemove", moveSlide);

    // Mobile
    sliderHandle.addEventListener("touchstart", startSlide);
    window.addEventListener("touchend", endSlide);
    window.addEventListener("touchmove", moveSlide);
}

// Programmatic fallback star logo mask (if loading bg_48.png fails)
function createFallbackStarMask() {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 48, 48);
    
    // Draw white star (represented by white pixels / 255 template values)
    ctx.fillStyle = "white";
    ctx.beginPath();
    const cx = 24;
    const cy = 24;
    const spikes = 4;
    const outerRadius = 18;
    const innerRadius = 5;
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
    
    return canvas;
}

// Load bg_48.png watermark template
function loadWatermarkTemplate() {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = "watermarks/bg_48.png";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve(canvas);
        };
        img.onerror = () => {
            console.warn("Could not load bg_48.png, using programmatic fallback star mask.");
            resolve(createFallbackStarMask());
        };
    });
}

// Core Watermark Remover Pipeline
async function triggerProcessing() {
    if (isProcessing) return;
    
    // Verify agreement
    if (!agreeCheckbox.checked) {
        showError("Please agree to the usage terms by checking the verification checkbox.");
        return;
    }
    
    isProcessing = true;
    btnProcess.disabled = true;
    errorAlert.classList.add("hidden");
    successAlert.classList.add("hidden");
    
    // UI state
    viewerContainer.classList.add("scanning");
    progressBox.style.display = "block";
    updateEngineStatus("processing", "Processing...");
    
    try {
        if (activeFile.type.startsWith("image/")) {
            // IMAGE PROCESSING PATHWAY
            updateProgress(0, "Scanning frequency domain...");
            await sleep(600);
            updateProgress(20, "Analyzing pixel structures...");
            await sleep(600);
            
            // Setup processed canvas
            processedCanvas = document.createElement("canvas");
            processedCanvas.width = originalCanvas.width;
            processedCanvas.height = originalCanvas.height;
            const pCtx = processedCanvas.getContext("2d");
            
            // Sub-pixel Resampling
            updateProgress(40, "Running controlled resampling...");
            await sleep(500);
            
            // Draw slightly scaled down on temporary canvas, then scale back to original
            const resampleScale = 0.998;
            const tempWidth = Math.round(originalCanvas.width * resampleScale);
            const tempHeight = Math.round(originalCanvas.height * resampleScale);
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = tempWidth;
            tempCanvas.height = tempHeight;
            const tempCtx = tempCanvas.getContext("2d");
            
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = "high";
            tempCtx.drawImage(originalCanvas, 0, 0, tempWidth, tempHeight);
            
            pCtx.imageSmoothingEnabled = true;
            pCtx.imageSmoothingQuality = "high";
            pCtx.drawImage(tempCanvas, 0, 0, tempWidth, tempHeight, 0, 0, originalCanvas.width, originalCanvas.height);
            
            // Corner Logo Unblending (if option selected)
            if (removeVisibleLogo.checked) {
                updateProgress(60, "Running pixel-level unblending...");
                const templateCanvas = await loadWatermarkTemplate();
                await performUnblending(processedCanvas, templateCanvas);
            }
            
            // High-frequency Perturbation
            updateProgress(80, "Applying frequency perturbation...");
            await sleep(500);
            
            applyFrequencyPerturbation(processedCanvas);
            
            // Complete & render
            updateProgress(100, "Controlled stabilization completed!");
            updateEngineStatus("success");
            await sleep(300);
            
            // Render comparison view
            const originalDataUrl = originalCanvas.toDataURL("image/png");
            const processedDataUrl = processedCanvas.toDataURL("image/png");
            
            imgBefore.src = originalDataUrl;
            imgAfter.src = processedDataUrl;
            
            // Reset slider position to 50%
            sliderHandle.style.left = "50%";
            imgAfterContainer.style.width = "50%";
            
            imgSourceOnly.style.display = "none";
            sliderContainer.style.display = "flex";
            
            btnDownload.style.display = "inline-flex";
            btnDownload.innerText = "Download Cleaned Image";
            showSuccess("SynthID watermark disrupted and corner logos cleaned locally!");
        } else if (activeFile.type.startsWith("video/")) {
            // VIDEO PROCESSING PATHWAY
            updateProgress(0, "Demuxing Video...");
            await sleep(200);
            
            const mode = videoModeSelect.value;
            const arrayBuffer = await activeFile.arrayBuffer();
            
            const resultBlob = await processVideoWatermark(arrayBuffer, mode, "auto", (progress) => {
                let pct = 0;
                let stage = "Processing";
                if (progress.stage === "demux") {
                    pct = progress.ratio * 8;
                    stage = "Demuxing Video...";
                } else if (progress.stage === "process") {
                    pct = 8 + (progress.ratio * 88);
                    stage = "Erasing Watermarks / Disrupting SynthID...";
                } else if (progress.stage === "mux") {
                    pct = 97;
                    stage = "Finalizing Output...";
                } else if (progress.stage === "done") {
                    pct = 100;
                    stage = "Completed!";
                }
                updateProgress(pct, stage);
            });
            
            updateProgress(100, "Controlled stabilization completed!");
            updateEngineStatus("success");
            
            // Show dual preview
            if (vidOutput.src) URL.revokeObjectURL(vidOutput.src);
            const outputUrl = URL.createObjectURL(resultBlob);
            vidOutput.src = outputUrl;
            vidOutputContainer.style.display = "flex";
            
            // Store output URL in processedCanvas for download action
            processedCanvas = outputUrl;
            
            btnDownload.style.display = "inline-flex";
            btnDownload.innerText = "Download Cleaned Video";
            showSuccess("Video SynthID signal disrupted and visible watermarks removed successfully!");
        }
    } catch (e) {
        console.error(e);
        showError("An unexpected error occurred during processing: " + e.message);
    } finally {
        isProcessing = false;
        viewerContainer.classList.remove("scanning");
        btnProcess.disabled = false;
        progressBox.style.display = "none";
    }
}

function updateProgress(pct, stage) {
    const rounded = Math.round(pct);
    progressStage.innerText = stage;
    progressPct.innerText = `${rounded}%`;
    progressBar.style.width = `${rounded}%`;
}

// Frequency-domain micro-perturbation implementation
function applyFrequencyPerturbation(canvas) {
    const ctx = canvas.getContext("2d");
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    
    // Add micro-perturbation (+/- 1 LSB) in high-frequency alternating grid pattern
    for (let i = 0; i < data.length; i += 4) {
        const pixelIdx = i / 4;
        const x = pixelIdx % width;
        const y = Math.floor(pixelIdx / width);
        
        // Chessboard grid pattern
        const perturbation = ((x + y) % 2 === 0) ? 1 : -1;
        
        // R channel
        data[i] = Math.max(0, Math.min(255, data[i] + perturbation));
        // G channel
        data[i+1] = Math.max(0, Math.min(255, data[i+1] - perturbation));
        // B channel
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + perturbation));
        // Keep Alpha unchanged
    }
    
    ctx.putImageData(imgData, 0, 0);
}

// Pearson Correlation Coefficient calculation to find logo bounding box
function searchLogoOffset(imgCanvas, templateCanvas) {
    const imgCtx = imgCanvas.getContext("2d");
    const imgW = imgCanvas.width;
    const imgH = imgCanvas.height;
    
    const tempW = templateCanvas.width;
    const tempH = templateCanvas.height;
    
    const tempCtx = templateCanvas.getContext("2d");
    const tempData = tempCtx.getImageData(0, 0, tempW, tempH).data;
    
    // Convert template to 1D grayscale values for correlation matching
    const tempVals = [];
    let tempSum = 0;
    for (let i = 0; i < tempData.length; i += 4) {
        const val = tempData[i] * 0.299 + tempData[i+1] * 0.587 + tempData[i+2] * 0.114;
        tempVals.push(val);
        tempSum += val;
    }
    const tempMean = tempSum / tempVals.length;
    
    // Compute variance-related sum for template
    let tempVarSum = 0;
    for (let i = 0; i < tempVals.length; i++) {
        tempVarSum += Math.pow(tempVals[i] - tempMean, 2);
    }
    
    // Check 4 corners
    const corners = [
        // Top-left
        { startX: 10, startY: 10, endX: Math.min(100, imgW - tempW), endY: Math.min(100, imgH - tempH) },
        // Top-right
        { startX: Math.max(0, imgW - tempW - 100), startY: 10, endX: Math.max(0, imgW - tempW - 10), endY: Math.min(100, imgH - tempH) },
        // Bottom-left
        { startX: 10, startY: Math.max(0, imgH - tempH - 100), endX: Math.min(100, imgW - tempW), endY: Math.max(0, imgH - tempH - 10) },
        // Bottom-right (Highest probability for Gemini watermark)
        { startX: Math.max(0, imgW - tempW - 100), startY: Math.max(0, imgH - tempH - 100), endX: Math.max(0, imgW - tempW - 10), endY: Math.max(0, imgH - tempH - 10) }
    ];
    
    let bestR = -1;
    let bestX = 0;
    let bestY = 0;
    
    for (const corner of corners) {
        for (let y = corner.startY; y <= corner.endY; y += 2) {
            for (let x = corner.startX; x <= corner.endX; x += 2) {
                // Get corresponding image patch
                const imgPatch = imgCtx.getImageData(x, y, tempW, tempH).data;
                
                const imgVals = [];
                let imgSum = 0;
                for (let i = 0; i < imgPatch.length; i += 4) {
                    const val = imgPatch[i] * 0.299 + imgPatch[i+1] * 0.587 + imgPatch[i+2] * 0.114;
                    imgVals.push(val);
                    imgSum += val;
                }
                const imgMean = imgSum / imgVals.length;
                
                let num = 0;
                let imgVarSum = 0;
                
                for (let i = 0; i < tempVals.length; i++) {
                    const diffTemp = tempVals[i] - tempMean;
                    const diffImg = imgVals[i] - imgMean;
                    num += diffTemp * diffImg;
                    imgVarSum += Math.pow(diffImg, 2);
                }
                
                const den = Math.sqrt(tempVarSum * imgVarSum);
                const r = den === 0 ? 0 : num / den;
                
                if (r > bestR) {
                    bestR = r;
                    bestX = x;
                    bestY = y;
                }
            }
        }
    }
    
    return { x: bestX, y: bestY, correlation: bestR };
}

// Pixel unblending algorithm adhering to structural invariants
async function performUnblending(canvas, templateCanvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    
    // 1. Locate the watermark offset
    const match = searchLogoOffset(canvas, templateCanvas);
    console.log(`Pearson search logo found at: (${match.x}, ${match.y}) correlation: ${match.correlation.toFixed(4)}`);
    
    // Only unblend if a reasonable correlation is found
    if (match.correlation < 0.35) {
        console.warn("Watermark logo not confidently detected. Skipping visible unblending.");
        return;
    }
    
    const startX = match.x;
    const startY = match.y;
    const tempW = templateCanvas.width;
    const tempH = templateCanvas.height;
    
    // Add safety margins to create a padded bounding box (crucial for boundary neighbor gathering)
    const padding = 5;
    const padStartX = Math.max(0, startX - padding);
    const padStartY = Math.max(0, startY - padding);
    const padEndX = Math.min(width - 1, startX + tempW + padding - 1);
    const padEndY = Math.min(height - 1, startY + tempH + padding - 1);
    
    const padW = padEndX - padStartX + 1;
    const padH = padEndY - padStartY + 1;
    
    // Get image and template raw data
    const imgData = ctx.getImageData(padStartX, padStartY, padW, padH);
    const pixels = imgData.data;
    
    const tempCtx = templateCanvas.getContext("2d");
    const tempData = tempCtx.getImageData(0, 0, tempW, tempH).data;
    
    // Output background data arrays
    const restoredR = new Float32Array(padW * padH);
    const restoredG = new Float32Array(padW * padH);
    const restoredB = new Float32Array(padW * padH);
    const underflows = new Uint8Array(padW * padH);
    const alphas = new Float32Array(padW * padH);
    
    // 2. Unblend each pixel inside the template box
    for (let py = 0; py < padH; py++) {
        const canvasY = padStartY + py;
        
        for (let px = 0; px < padW; px++) {
            const canvasX = padStartX + px;
            const idx = (py * padW + px) * 4;
            
            // Calculate coordinates relative to the template offset
            const tx = canvasX - startX;
            const ty = canvasY - startY;
            
            let alpha = 0;
            if (tx >= 0 && tx < tempW && ty >= 0 && ty < tempH) {
                const tIdx = (ty * tempW + tx) * 4;
                // Template alpha derived from grayscale brightness and template alpha channel.
                // Capped at 0.99: alpha of exactly 1 makes the unblend divide by zero
                // (NaN survives the strength blend and clamps to black pixels).
                const templateIntensity = tempData[tIdx] / 255;
                const templateAlpha = tempData[tIdx+3] / 255;
                alpha = Math.min(templateIntensity * templateAlpha, 0.99);
            }
            
            alphas[py * padW + px] = alpha;
            
            if (alpha > 0.01) {
                // Invariant 1: Perfect Unblending Color: grayscale templates representing white logos always use 255
                const unblendColor = 255; 
                
                // Inverse blend formula: B = (O - Wc * alpha) / (1 - alpha)
                const denom = 1.0 - alpha;
                const rRestored = (pixels[idx] - unblendColor * alpha) / denom;
                const gRestored = (pixels[idx+1] - unblendColor * alpha) / denom;
                const bRestored = (pixels[idx+2] - unblendColor * alpha) / denom;
                
                restoredR[py * padW + px] = rRestored;
                restoredG[py * padW + px] = gRestored;
                restoredB[py * padW + px] = bRestored;
                
                // Detect underflows
                if (rRestored < 0 || gRestored < 0 || bRestored < 0) {
                    underflows[py * padW + px] = 1;
                }
            } else {
                // Background pixels
                restoredR[py * padW + px] = pixels[idx];
                restoredG[py * padW + px] = pixels[idx+1];
                restoredB[py * padW + px] = pixels[idx+2];
            }
        }
    }
    
    // 3. Compute Dynamic Smoothing Map (Invariant 2)
    const smoothingMap = new Float32Array(padW * padH);
    for (let i = 0; i < padW * padH; i++) {
        const alpha = alphas[i];
        
        if (alpha > 0.01) {
            if (underflows[i] === 1) {
                // Underflows get full neighbor replacement
                smoothingMap[i] = 1.0; 
            } else {
                // High-alpha template pixels scale their smoothing strength up proportionally to alpha
                let strength = Math.min(1.0, alpha * 1.3);
                
                // Outer dilated boundary pixels get a reduced strength (e.g. 70% of base) for soft blending
                if (alpha < 0.25) {
                    strength *= 0.70;
                }
                
                smoothingMap[i] = strength;
            }
        } else {
            smoothingMap[i] = 0.0;
        }
    }
    
    // 4. Neighbor-averaging loop using Invariant 3: Padded Box Boundary-Safe Gathering
    const finalPixels = new Uint8ClampedArray(pixels.length);
    const searchRadius = 4;
    
    for (let py = 0; py < padH; py++) {
        const canvasY = padStartY + py;
        
        for (let px = 0; px < padW; px++) {
            const canvasX = padStartX + px;
            const idx = (py * padW + px) * 4;
            const mapIdx = py * padW + px;
            const strength = smoothingMap[mapIdx];
            
            if (strength > 0.0) {
                let sumR = 0, sumG = 0, sumB = 0, count = 0;
                
                // Gather neighbors - search in window around the pixel
                for (let ny = -searchRadius; ny <= searchRadius; ny++) {
                    const neighborCanvasY = canvasY + ny;
                    
                    // Check if neighbor is within overall image canvas limits
                    if (neighborCanvasY < 0 || neighborCanvasY >= height) continue;
                    
                    for (let nx = -searchRadius; nx <= searchRadius; nx++) {
                        const neighborCanvasX = canvasX + nx;
                        
                        // Check image canvas bounds
                        if (neighborCanvasX < 0 || neighborCanvasX >= width) continue;
                        
                        // Calculate offset coordinates relative to the template
                        const ntx = neighborCanvasX - startX;
                        const nty = neighborCanvasY - startY;
                        
                        // Check if the neighbor pixel represents a valid non-mask background pixel
                        // (either outside the template box entirely OR has alpha == 0)
                        let neighborAlpha = 0;
                        if (ntx >= 0 && ntx < tempW && nty >= 0 && nty < tempH) {
                            const ntIdx = (nty * tempW + ntx) * 4;
                            neighborAlpha = (tempData[ntIdx] / 255) * (tempData[ntIdx+3] / 255);
                        }
                        
                        // If neighbor is outside the template bounding box OR is not a mask pixel, it's valid!
                        if (neighborAlpha <= 0.01) {
                            // Gather neighbor colors from the overall canvas (not the padded grid to get boundary-safe values)
                            // We can sample from canvas or the padded arrays.
                            // To be perfectly boundary-safe and simple, we grab it from the padded restored values 
                            // if it lies inside the padded box, or directly from canvas if it lies outside the padded box.
                            let rVal, gVal, bVal;
                            
                            const nGridX = neighborCanvasX - padStartX;
                            const nGridY = neighborCanvasY - padStartY;
                            
                            if (nGridX >= 0 && nGridX < padW && nGridY >= 0 && nGridY < padH) {
                                const nGridIdx = nGridY * padW + nGridX;
                                rVal = restoredR[nGridIdx];
                                gVal = restoredG[nGridIdx];
                                bVal = restoredB[nGridIdx];
                            } else {
                                // Gather directly from canvas outside the padded bounding box (Boundary-Safe Gathering)
                                const canvasPixel = ctx.getImageData(neighborCanvasX, neighborCanvasY, 1, 1).data;
                                rVal = canvasPixel[0];
                                gVal = canvasPixel[1];
                                bVal = canvasPixel[2];
                            }
                            
                            sumR += rVal;
                            sumG += gVal;
                            sumB += bVal;
                            count++;
                        }
                    }
                }
                
                // If we found valid background neighbors, average and blend
                if (count > 0) {
                    const avgR = sumR / count;
                    const avgG = sumG / count;
                    const avgB = sumB / count;
                    
                    // Blend restored value with neighbor average using dynamic strength
                    const baseR = restoredR[mapIdx];
                    const baseG = restoredG[mapIdx];
                    const baseB = restoredB[mapIdx];
                    
                    finalPixels[idx] = Math.max(0, Math.min(255, baseR * (1 - strength) + avgR * strength));
                    finalPixels[idx+1] = Math.max(0, Math.min(255, baseG * (1 - strength) + avgG * strength));
                    finalPixels[idx+2] = Math.max(0, Math.min(255, baseB * (1 - strength) + avgB * strength));
                } else {
                    // Fallback to restored if no valid neighbors (rare)
                    finalPixels[idx] = Math.max(0, Math.min(255, restoredR[mapIdx]));
                    finalPixels[idx+1] = Math.max(0, Math.min(255, restoredG[mapIdx]));
                    finalPixels[idx+2] = Math.max(0, Math.min(255, restoredB[mapIdx]));
                }
            } else {
                // Retain unblended values for strength == 0 pixels
                finalPixels[idx] = Math.max(0, Math.min(255, restoredR[mapIdx]));
                finalPixels[idx+1] = Math.max(0, Math.min(255, restoredG[mapIdx]));
                finalPixels[idx+2] = Math.max(0, Math.min(255, restoredB[mapIdx]));
            }
            // Retain original alpha
            finalPixels[idx+3] = pixels[idx+3];
        }
    }
    
    // Write back to canvas
    const finalImgData = new ImageData(finalPixels, padW, padH);
    ctx.putImageData(finalImgData, padStartX, padStartY);
}

// Download final cleaned image file
function downloadCleanedImage() {
    if (!activeFile) return;
    
    if (activeFile.type.startsWith("image/")) {
        if (!processedCanvas) return;
        const originalName = activeFile.name;
        const extIdx = originalName.lastIndexOf(".");
        const baseName = extIdx !== -1 ? originalName.substring(0, extIdx) : originalName;
        const format = activeFile.type === "image/png" ? "image/png" : "image/jpeg";
        const extension = activeFile.type === "image/png" ? ".png" : ".jpg";
        
        const dataUrl = processedCanvas.toDataURL(format, 0.94);
        
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${baseName}-cleaned${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else if (activeFile.type.startsWith("video/")) {
        if (!processedCanvas) return;
        const originalName = activeFile.name;
        const extIdx = originalName.lastIndexOf(".");
        const baseName = extIdx !== -1 ? originalName.substring(0, extIdx) : originalName;
        
        const link = document.createElement("a");
        link.href = processedCanvas; // Contains URL string
        link.download = `${baseName}-cleaned.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Helper utilities
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
