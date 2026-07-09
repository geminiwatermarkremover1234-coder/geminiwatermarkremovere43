/**
 * Gemini Video Watermark Remover - Core Processor Engine
 * Fully client-side processing using WebCodecs (VideoDecoder/VideoEncoder), Canvas, MP4Box, and Mp4Muxer.
 */

const SUPPORTED_DIMENSIONS = new Set(["1280x720", "720x1280", "1920x1080", "1080x1920", "3840x2160", "2160x3840", "848x478", "478x848"]);
const WATERMARK_ASSET_VERSION = "15";
const OPACITY_CANDIDATES = [1.0, 0.62];
const RESOLUTION_OFFSETS_720P = [144, 120, 128, 72];
const RESOLUTION_OFFSETS_1080P = [222, 186];

// Helper to clamp values
function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

// Helper to get Canvas 2D Context
function getCanvasContext(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas processing context is unavailable in this browser.");
    return ctx;
}

/**
 * Loads a watermark image and converts it to value and color maps.
 */
async function loadWatermarkMap(url, width, height, isColor) {
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load watermark template: ${url}`));
        // Cache-buster: template PNGs change between releases but keep the
        // same URL; heuristic HTTP caching otherwise serves stale shapes
        image.src = url + (url.includes("?") ? "&" : "?") + "v=" + WATERMARK_ASSET_VERSION;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = getCanvasContext(canvas);
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height).data;
    const values = new Float32Array(width * height);
    const colorValues = isColor ? new Float32Array(width * height * 3) : undefined;

    for (let i = 0; i < values.length; i++) {
        const offset = 4 * i;
        if (isColor) {
            // For colored overlays, extract alpha from alpha channel, and color values
            values[i] = imgData[offset + 3] / 255;
            colorValues[3 * i] = imgData[offset];
            colorValues[3 * i + 1] = imgData[offset + 1];
            colorValues[3 * i + 2] = imgData[offset + 2];
        } else {
            // For grayscale overlays, combine intensity with the PNG alpha
            // channel — white-on-transparent templates (Veo) carry their
            // shape in alpha, opaque grayscale ones (bg_48) in intensity
            values[i] = (Math.max(imgData[offset], imgData[offset + 1], imgData[offset + 2]) / 255) * (imgData[offset + 3] / 255);
        }
    }

    return { values, colorValues, width, height };
}

/**
 * Calculates average background brightness around the watermark region
 */
function calculateBackgroundBrightness(imageData, watermark) {
    const padding = Math.max(8, Math.round(0.25 * watermark.alphaMap.width));
    const startX = Math.max(0, watermark.x - padding);
    const startY = Math.max(0, watermark.y - padding);
    const endX = Math.min(imageData.width, watermark.x + watermark.alphaMap.width + padding);
    const endY = Math.min(imageData.height, watermark.y + watermark.alphaMap.height + padding);

    let sum = 0;
    let count = 0;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            // Exclude actual watermark box
            if (x >= watermark.x && x < watermark.x + watermark.alphaMap.width &&
                y >= watermark.y && y < watermark.y + watermark.alphaMap.height) {
                continue;
            }
            const offset = (y * imageData.width + x) * 4;
            // standard luminance conversion weights
            sum += 0.2126 * imageData.data[offset] + 0.7152 * imageData.data[offset + 1] + 0.0722 * imageData.data[offset + 2];
            count++;
        }
    }

    return count > 0 ? sum / count : null;
}

/**
 * Simple opacity estimation: find opacity that makes watermark brightness match background
 * Uses a correlation-based approach: find opacity where the watermark SHAPE disappears
 */
function findOptimalOpacitySimple(imageData, watermark) {
    const bgLuminance = calculateBackgroundBrightness(imageData, watermark);
    if (bgLuminance === null) return 0.55; // Default fallback
    
    const width = watermark.alphaMap.width;
    const height = watermark.alphaMap.height;
    const overlayValue = watermark.overlayValue ?? 255;
    const overlayColors = watermark.overlayColors || null;
    const baseStrength = watermark.baseStrength ?? 1.0;
    
    let bestOpacity = 0.55;
    let bestScore = Infinity;
    
    // Test opacity from 0.15 to 1.00 in steps of 0.05
    for (let op = 0.15; op <= 1.001; op += 0.05) {
        let totalLum = 0;
        let count = 0;
        let frameSum = 0, frameSqSum = 0, templateSum = 0, templateSqSum = 0, crossSum = 0;
        let overSubCount = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const alpha = watermark.alphaMap.values[idx];
                if (alpha <= 0.10) continue;
                
                const p = Math.min(alpha * baseStrength * op, 1.0);
                if (p < 0.002) continue;
                const invP = 1 - p;
                if (invP <= 0.0001) continue;
                
                const pxOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
                let pixelLum = 0;
                for (let c = 0; c < 3; c++) {
                    const wColor = overlayColors ? overlayColors[c] : overlayValue;
                    const restored = (imageData.data[pxOffset + c] - p * wColor) / invP;
                    pixelLum += restored * (c === 0 ? 0.2126 : c === 1 ? 0.7152 : 0.0722);
                }
                
                // Track over-subtraction: restored luminance going genuinely
                // below zero (physically impossible), not just darker than average
                if (pixelLum < 0) {
                    overSubCount++;
                }
                
                const normLum = Math.max(0, Math.min(255, pixelLum)) / 255;
                totalLum += pixelLum;
                count++;
                
                // Correlation between restored luminance and alpha template
                // If watermark is fully removed, correlation should be ~0
                frameSum += normLum;
                frameSqSum += normLum * normLum;
                templateSum += alpha;
                templateSqSum += alpha * alpha;
                crossSum += normLum * alpha;
            }
        }
        
        if (count > 5) {
            const avgLum = totalLum / count;
            const brightnessDiff = Math.abs(avgLum - bgLuminance);
            
            // Calculate correlation
            let correlation = 0;
            const meanFrame = frameSum / count;
            const meanTemplate = templateSum / count;
            const stdDenom = Math.sqrt(
                (frameSqSum - count * meanFrame * meanFrame) * 
                (templateSqSum - count * meanTemplate * meanTemplate)
            );
            if (stdDenom > 0) {
                correlation = (crossSum - count * meanFrame * meanTemplate) / stdDenom;
            }
            
            // Score: strongly penalize remaining watermark pattern (correlation)
            // Use over-subtraction as a guard instead of brightnessDiff
            // Higher opacities get a small bonus to ensure complete removal
            const overSubRatio = count > 0 ? overSubCount / count : 0;
            const overSubPenalty = overSubRatio > 0.50 ? 50 * overSubRatio : 0;
            const score = 200 * Math.abs(correlation) + overSubPenalty - 5 * op;
            
            if (score < bestScore) {
                bestScore = score;
                bestOpacity = op;
            }
        }
    }
    
    // Round to nearest 0.05
    bestOpacity = Math.round(bestOpacity * 20) / 20;
    console.log(`Opacity estimation: ${bestOpacity} (bg=${bgLuminance.toFixed(1)}, score=${bestScore.toFixed(2)})`);
    return bestOpacity;
}

/**
 * Measures residual watermark visibility after unblending
 * Returns how far the watermark area differs from surrounding background
 */
function measureResidual(imageData, watermark) {
    const bgLuminance = calculateBackgroundBrightness(imageData, watermark);
    if (bgLuminance === null) return Infinity;
    
    const width = watermark.alphaMap.width;
    const height = watermark.alphaMap.height;
    let sumDiff = 0;
    let count = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const alpha = watermark.alphaMap.values[idx];
            if (alpha <= 0.10) continue;
            
            const pxOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
            const lum = 0.2126 * imageData.data[pxOffset] + 
                        0.7152 * imageData.data[pxOffset + 1] + 
                        0.0722 * imageData.data[pxOffset + 2];
            
            sumDiff += Math.abs(lum - bgLuminance);
            count++;
        }
    }
    
    return count > 0 ? sumDiff / count : Infinity;
}

/**
 * Multi-pass alpha recalibration: try different alpha gains and pick the one
 * that minimizes residual watermark visibility.
 * Based on the GargantuaX/gemini-watermark-remover approach.
 */
function findBestAlphaGain(imageData, watermark) {
    const gains = [0.85, 1.0, 1.15, 1.3, 1.45, 1.7, 0.7, 0.55];
    let bestGain = 1.0;
    let bestResidual = Infinity;
    
    const tempData = new Uint8ClampedArray(imageData.data);
    const overlayValue = watermark.overlayValue ?? 255;
    const opacity = watermark.opacity ?? 1.0;
    const ceiling = watermark.ceiling ?? 1.0;
    const wWidth = watermark.alphaMap.width;
    const wHeight = watermark.alphaMap.height;
    
    for (const gain of gains) {
        // Unblend with this gain
        for (let y = 0; y < wHeight; y++) {
            for (let x = 0; x < wWidth; x++) {
                const idx = y * wWidth + x;
                const alphaVal = watermark.alphaMap.values[idx];
                const p = Math.min(alphaVal * gain * opacity, ceiling);
                if (p < 0.002) continue;
                const invP = 1 - p;
                if (invP <= 0.0001) continue;
                
                const pxOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
                for (let c = 0; c < 3; c++) {
                    const restored = (imageData.data[pxOffset + c] - p * overlayValue) / invP;
                    tempData[pxOffset + c] = Math.round(clamp(restored, 0, 255));
                }
            }
        }
        
        // Measure residual
        const tempImageData = { data: tempData, width: imageData.width, height: imageData.height };
        const residual = measureResidual(tempImageData, watermark);
        
        if (residual < bestResidual) {
            bestResidual = residual;
            bestGain = gain;
        }
    }
    
    console.log(`Multi-pass recalibration: best gain=${bestGain} (residual=${bestResidual.toFixed(2)})`);
    return bestGain;
}

/**
 * Computes a score for a given candidate configuration and opacity
 */
function scoreWatermarkOpacity(imageData, watermark, opacity) {
    const bgLuminance = calculateBackgroundBrightness(imageData, watermark);
    if (bgLuminance === null) return { opacity, score: Infinity };

    const isColor = watermark.alphaMap.colorValues !== undefined;
    const colors = watermark.alphaMap.colorValues;
    const baseStrength = watermark.baseStrength;
    const width = watermark.alphaMap.width;
    const height = watermark.alphaMap.height;

    let edgeNoiseSum = 0;
    let edgeNoiseCount = 0;
    let outOfBoundsSum = 0;
    let outOfBoundsCount = 0;
    let overSubtractionSum = 0;
    let overSubtractionCount = 0;

    let frameSum = 0;
    let frameSqSum = 0;
    let templateSum = 0;
    let templateSqSum = 0;
    let crossSum = 0;
    let corrCount = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const alpha = watermark.alphaMap.values[idx];
            if (alpha <= 0.04) continue;

            const p = Math.min(alpha * baseStrength * opacity, opacity);
            const invP = 1 - p;
            if (invP <= 0.0001) continue;

            const pixelOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
            const restored = [0, 0, 0];
            let outOfBoundsPenalty = 0;

            for (let c = 0; c < 3; c++) {
                const wColor = isColor && colors ? colors[3 * idx + c] : 255;
                const origVal = imageData.data[pixelOffset + c];
                const unblended = (origVal - p * wColor) / invP;
                restored[c] = unblended;
                outOfBoundsPenalty += Math.max(0, -unblended, unblended - 255);
            }

            const luminance = 0.2126 * restored[0] + 0.7152 * restored[1] + 0.0722 * restored[2];
            const weight = Math.min(1.0, 8 * alpha);

            // Penalize over-subtraction: when restored luminance goes BELOW background
            // This is a directional penalty - being too dark is worse than being too bright
            // because it indicates the opacity is too high
            const overSub = Math.max(0, bgLuminance - luminance);
            overSubtractionSum += overSub * weight;
            overSubtractionCount += weight;

            outOfBoundsSum += (outOfBoundsPenalty / 3) * weight;
            outOfBoundsCount += weight;

            // Correlation variables (normalized to 0-1 for precision)
            const normLum = luminance / 255;
            frameSum += normLum;
            frameSqSum += normLum * normLum;
            templateSum += alpha;
            templateSqSum += alpha * alpha;
            crossSum += normLum * alpha;
            corrCount++;

            // Neighbor smoothness score: compare with low-alpha boundary pixels
            let neighborDiffSum = 0;
            let neighborDiffCount = 0;
            for (let ny = -1; ny <= 1; ny++) {
                for (let nx = -1; nx <= 1; nx++) {
                    if (ny === 0 && nx === 0) continue;
                    const mapX = x + nx;
                    const mapY = y + ny;

                    if (mapX < 0 || mapX >= width || mapY < 0 || mapY >= height) continue;
                    // Only compare with pixels that are mostly non-watermark
                    if (watermark.alphaMap.values[mapY * width + mapX] > 0.04) continue;

                    const neighborOffset = ((watermark.y + mapY) * imageData.width + watermark.x + mapX) * 4;
                    const neighborLuminance = 0.2126 * imageData.data[neighborOffset] +
                                              0.7152 * imageData.data[neighborOffset + 1] +
                                              0.0722 * imageData.data[neighborOffset + 2];
                    neighborDiffSum += Math.abs(luminance - neighborLuminance);
                    neighborDiffCount++;
                }
            }

            if (neighborDiffCount > 0) {
                edgeNoiseSum += (neighborDiffSum / neighborDiffCount) * weight;
                edgeNoiseCount += weight;
            }
        }
    }

    const smoothnessScore = edgeNoiseCount > 0 ? edgeNoiseSum / edgeNoiseCount : Infinity;
    const penaltyScore = outOfBoundsCount > 0 ? outOfBoundsSum / outOfBoundsCount : 0;
    const overSubScore = overSubtractionCount > 0 ? overSubtractionSum / overSubtractionCount : 0;

    let correlation = 0;
    if (corrCount > 0) {
        const meanFrame = frameSum / corrCount;
        const meanTemplate = templateSum / corrCount;
        const stdDenominator = Math.sqrt(
            (frameSqSum - corrCount * meanFrame * meanFrame) * 
            (templateSqSum - corrCount * meanTemplate * meanTemplate)
        );
        if (stdDenominator > 0) {
            correlation = (crossSum - corrCount * meanFrame * meanTemplate) / stdDenominator;
        }
    }

    // Combined score: prioritize removing watermark pattern over noise suppression
    // Aggressive removal with edge cleanup handles the resulting artifacts
    const score = 0.08 * smoothnessScore + 0.02 * penaltyScore + 0.05 * overSubScore + 0.8 * Math.abs(correlation);
    return { opacity, score };
}

/**
 * Samples average background color (per channel + luma) around the watermark box
 */
function sampleBackground(imageData, watermark) {
    const padding = Math.max(8, Math.round(0.25 * watermark.alphaMap.width));
    const startX = Math.max(0, watermark.x - padding);
    const startY = Math.max(0, watermark.y - padding);
    const endX = Math.min(imageData.width, watermark.x + watermark.alphaMap.width + padding);
    const endY = Math.min(imageData.height, watermark.y + watermark.alphaMap.height + padding);

    const sums = [0, 0, 0];
    let count = 0;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            if (x >= watermark.x && x < watermark.x + watermark.alphaMap.width &&
                y >= watermark.y && y < watermark.y + watermark.alphaMap.height) {
                continue;
            }
            const offset = (y * imageData.width + x) * 4;
            sums[0] += imageData.data[offset];
            sums[1] += imageData.data[offset + 1];
            sums[2] += imageData.data[offset + 2];
            count++;
        }
    }

    if (count === 0) return null;
    const channels = sums.map(s => s / count);
    return {
        luma: 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2],
        channels
    };
}

/**
 * Scores one opacity candidate: weighted least-squares opacity estimate against
 * background, plus brightness/smoothness/out-of-bounds terms
 */
function scoreOpacityCandidateRef(imageData, watermark, candidateOpacity) {
    const bg = sampleBackground(imageData, watermark);
    if (bg === null) return { opacity: candidateOpacity, score: Infinity };

    const isColor = watermark.alphaMap.colorValues !== undefined;
    const colors = watermark.alphaMap.colorValues;
    const wWidth = watermark.alphaMap.width;
    const wHeight = watermark.alphaMap.height;

    // Weighted least-squares estimate of the true opacity
    let lsNum = 0;
    let lsDenom = 0;
    for (let y = 0; y < wHeight; y++) {
        for (let x = 0; x < wWidth; x++) {
            const idx = y * wWidth + x;
            const alpha = watermark.alphaMap.values[idx];
            if (alpha <= 0.08) continue;

            const pxOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
            const weight = Math.min(1, 8 * alpha);
            for (let c = 0; c < 3; c++) {
                const wColor = isColor && colors ? colors[3 * idx + c] : 250;
                const bgChannel = bg.channels[c];
                const coeff = alpha * watermark.baseStrength * (wColor - bgChannel);
                if (coeff <= 2) continue;
                lsNum += (imageData.data[pxOffset + c] - bgChannel) * coeff * weight;
                lsDenom += coeff * coeff * weight;
            }
        }
    }
    const lsEstimate = lsDenom <= 0 ? null : clamp(lsNum / lsDenom, 0, 1);

    // Unblend test with the candidate opacity
    let brightnessSum = 0, brightnessCount = 0;
    let edgeSum = 0, edgeCount = 0;
    let oobSum = 0, oobCount = 0;

    for (let y = 0; y < wHeight; y++) {
        for (let x = 0; x < wWidth; x++) {
            const idx = y * wWidth + x;
            const alpha = watermark.alphaMap.values[idx];
            if (alpha <= 0.04) continue;

            const p = Math.min(alpha * watermark.baseStrength * candidateOpacity, candidateOpacity);
            const invP = 1 - p;
            if (invP <= 0.0001) continue;

            const pxOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
            const restored = [0, 0, 0];
            let oobPenalty = 0;
            for (let c = 0; c < 3; c++) {
                const wColor = isColor && colors ? colors[3 * idx + c] : 250;
                const unblended = (imageData.data[pxOffset + c] - p * wColor) / invP;
                restored[c] = unblended;
                oobPenalty += Math.max(0, -unblended, unblended - 255);
            }

            const luminance = 0.2126 * restored[0] + 0.7152 * restored[1] + 0.0722 * restored[2];
            const weight = Math.min(1, 8 * alpha);
            brightnessSum += Math.abs(luminance - bg.luma) * weight;
            brightnessCount += weight;
            oobSum += (oobPenalty / 3) * weight;
            oobCount += weight;

            let neighborDiffSum = 0;
            let neighborDiffCount = 0;
            for (let ny = -1; ny <= 1; ny++) {
                for (let nx = -1; nx <= 1; nx++) {
                    if (nx === 0 && ny === 0) continue;
                    const mapX = x + nx;
                    const mapY = y + ny;
                    if (mapX < 0 || mapX >= wWidth || mapY < 0 || mapY >= wHeight) continue;
                    if (watermark.alphaMap.values[mapY * wWidth + mapX] > 0.04) continue;

                    const nOffset = ((watermark.y + mapY) * imageData.width + watermark.x + mapX) * 4;
                    const nLum = 0.2126 * imageData.data[nOffset] +
                                 0.7152 * imageData.data[nOffset + 1] +
                                 0.0722 * imageData.data[nOffset + 2];
                    neighborDiffSum += Math.abs(luminance - nLum);
                    neighborDiffCount++;
                }
            }
            if (neighborDiffCount > 0) {
                edgeSum += (neighborDiffSum / neighborDiffCount) * weight;
                edgeCount += weight;
            }
        }
    }

    const brightnessScore = brightnessCount > 0 ? brightnessSum / brightnessCount : Infinity;
    const smoothnessScore = edgeCount > 0 ? edgeSum / edgeCount : brightnessScore;
    const primary = lsEstimate === null ? brightnessScore : 255 * Math.abs(lsEstimate - candidateOpacity);

    return {
        opacity: candidateOpacity,
        lsEstimate,
        score: 0.75 * primary + 0.15 * brightnessScore + 0.08 * smoothnessScore + 0.02 * (oobCount > 0 ? oobSum / oobCount : 0)
    };
}

/**
 * Picks the lowest-score opacity candidate
 */
function pickBestOpacity(scores, biasLowerOpacity = false) {
    const valid = scores.filter(s => Number.isFinite(s.score)).sort((a, b) => a.score - b.score);
    if (!valid.length) {
        return { opacity: OPACITY_CANDIDATES[0], margin: 0, scores };
    }
    let primary = valid[0];
    // Veo-only margin bias: when 1.0 wins but a lower-opacity candidate scores
    // within 2.5, prefer the lower opacity — the Veo template alpha is
    // calibrated for the 0.62 candidate, and a full-strength unblend
    // over-subtracts, leaving a dark "Veo" imprint (see
    // fix-video-watermark-blur design decision 4)
    if (biasLowerOpacity && primary.opacity >= 1.0) {
        const closeLower = valid.find(s => s.opacity < 1.0 && s.score - primary.score <= 2.5);
        if (closeLower) primary = closeLower;
    }
    // Veo-only: refine to the continuous LS estimate. The discrete candidates
    // (1.0 / 0.62) leave a residual "Veo" imprint when the true blend opacity
    // sits between them; the LS estimate is exact under the blend model (see
    // fix-veo-residual-ghost). Bounded to ±0.18 of the discrete winner so a
    // noisy estimate falls back to today's behavior.
    let chosenOpacity = primary.opacity;
    if (biasLowerOpacity) {
        const ls = scores.map(s => s.lsEstimate).filter(v => Number.isFinite(v));
        if (ls.length) {
            const avgLs = ls.reduce((a, b) => a + b, 0) / ls.length;
            if (Math.abs(avgLs - primary.opacity) <= 0.18) {
                chosenOpacity = clamp(avgLs, 0.40, 1.0);
            }
        }
    }
    const runnerUp = valid.find(s => s !== primary) ?? null;
    return {
        opacity: chosenOpacity,
        margin: runnerUp ? runnerUp.score - primary.score : Infinity,
        scores
    };
}

/**
 * Evaluates opacity candidates for a single frame.
 * Colored overlays (1080p paired-star template) always use opacity 1.
 */
function evaluateOpacityScores(imageData, watermark) {
    if (watermark.alphaMap.colorValues !== undefined) {
        return { opacity: 1, margin: Infinity, scores: [{ opacity: 1, score: 0 }] };
    }
    return pickBestOpacity(OPACITY_CANDIDATES.map(op => scoreOpacityCandidateRef(imageData, watermark, op)), watermark.isVeo === true);
}

/**
 * Compiles the best opacity based on parsed sample frames
 */
function findBestOpacity(sampleFrames, watermark) {
    if (!sampleFrames.length) {
        return { opacity: OPACITY_CANDIDATES[0], margin: 0, scores: [] };
    }

    const results = OPACITY_CANDIDATES.map(op => ({ opacity: op, score: 0, count: 0, lsSum: 0, lsCount: 0 }));

    for (const frame of sampleFrames) {
        for (const s of evaluateOpacityScores(frame.imageData, watermark).scores) {
            const res = results.find(r => r.opacity === s.opacity);
            if (res && Number.isFinite(s.score)) {
                res.score += s.score;
                res.count++;
                if (Number.isFinite(s.lsEstimate)) { res.lsSum += s.lsEstimate; res.lsCount++; }
            }
        }
    }

    return pickBestOpacity(results.map(r => ({
        opacity: r.opacity,
        score: r.count > 0 ? r.score / r.count : Infinity,
        lsEstimate: r.lsCount > 0 ? r.lsSum / r.lsCount : null
    })), watermark.isVeo === true);
}

/**
 * Calculates spatial correlation between frame pixels and watermark mask
 */
function calculateWatermarkCorrelation(imageData, watermark) {
    let frameSum = 0;
    let frameSqSum = 0;
    let templateSum = 0;
    let templateSqSum = 0;
    let crossSum = 0;
    let count = 0;

    const width = watermark.alphaMap.width;
    const height = watermark.alphaMap.height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const templateAlpha = watermark.alphaMap.values[y * width + x];
            if (templateAlpha <= 0.08) continue;

            const pixelOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
            const luminance = (imageData.data[pixelOffset] + imageData.data[pixelOffset + 1] + imageData.data[pixelOffset + 2]) / 765;

            frameSum += luminance;
            frameSqSum += luminance * luminance;
            templateSum += templateAlpha;
            templateSqSum += templateAlpha * templateAlpha;
            crossSum += luminance * templateAlpha;
            count++;
        }
    }

    // Flat frames (fade-in from black, solid backgrounds) carry no signal —
    // return neutral 0, not -Infinity: scores are summed across the detection
    // window and a single -Infinity would poison a candidate permanently.
    if (count === 0) return 0;

    const meanFrame = frameSum / count;
    const meanTemplate = templateSum / count;
    const stdDenominator = Math.sqrt((frameSqSum - count * meanFrame * meanFrame) * (templateSqSum - count * meanTemplate * meanTemplate));

    if (stdDenominator <= 0) return 0;

    return (crossSum - count * meanFrame * meanTemplate) / stdDenominator;
}

/**
 * Unblends and cleans a single frame
 * Now includes multi-pass alpha recalibration for better watermark removal
 */
function cleanFrameWatermark(imageData, watermark) {
    const data = new Uint8ClampedArray(imageData.data);
    const opacity = watermark.opacity !== undefined ? watermark.opacity : 1.0;
    const ceiling = watermark.ceiling ?? 1.0;
    const isColor = watermark.alphaMap.colorValues !== undefined;
    const colors = watermark.alphaMap.colorValues;
    const overlayValue = watermark.overlayValue ?? 255;
    // Use per-channel overlay color estimate when available for better accuracy
    const overlayColors = watermark.overlayColors || null;
    const wWidth = watermark.alphaMap.width;
    const wHeight = watermark.alphaMap.height;

    // Use base strength directly (alpha gain is applied via opacity estimation)
    const effectiveBaseStrength = watermark.baseStrength ?? 1.0;

    // Padding around the watermark bounding box for boundary blending
    const radius = watermark.edgeCleanup?.radius ?? 5;
    const pad = Math.max(8, radius + 3);
    const padWidth = wWidth + 2 * pad;
    const padHeight = wHeight + 2 * pad;

    // Track which pixels need inpainting and which just need light smoothing
    const strengthMap = watermark.edgeCleanup ? new Float32Array(padWidth * padHeight) : null;
    const originalMask = watermark.edgeCleanup ? new Uint8Array(padWidth * padHeight) : null;
    // Store the unblended data for reference
    const unblendedData = new Uint8ClampedArray(data);

    // Step 1: Pixel unblending (alpha-inverse compositing) with optimal alpha gain
    for (let y = 0; y < wHeight; y++) {
        for (let x = 0; x < wWidth; x++) {
            const idx = y * wWidth + x;
            const alphaVal = watermark.alphaMap.values[idx];
            const p = Math.min(alphaVal * effectiveBaseStrength * opacity, ceiling);

            if (p < 0.002) continue;

            const pxOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
            const invP = 1 - p;

            if (invP <= 0.0001) continue;

            let hasUnderflow = false;
            for (let c = 0; c < 3; c++) {
                const wColor = isColor && colors ? colors[3 * idx + c] : overlayColors ? overlayColors[c] : overlayValue;
                const originalVal = imageData.data[pxOffset + c];
                const restoredVal = (originalVal - p * wColor) / invP;
            if (restoredVal < 5) {
                hasUnderflow = true;
            }
            data[pxOffset + c] = Math.round(clamp(restoredVal, 0, 255));
            }

            if (originalMask) {
                const mapIdx = (y + pad) * padWidth + (x + pad);
                originalMask[mapIdx] = 1;
                if (hasUnderflow) {
                    strengthMap[mapIdx] = 1.5; // sentinel: underflow (distinct from template pixels)
                }
            }
        }
    }

    // Copy unblended result for reference in smoothing
    unblendedData.set(data);

    // Step 2: Texture-preserving cleanup using dynamic strength map
    if (watermark.edgeCleanup && strengthMap) {
        const { radius } = watermark.edgeCleanup;
        const baseStrength = watermark.edgeCleanup.strength ?? 0.6;

        // Dilate original mask to include boundary/transition zone
        const dilatedMask = new Uint8Array(padWidth * padHeight);
        for (let y = 0; y < padHeight; y++) {
            for (let x = 0; x < padWidth; x++) {
                if (originalMask[y * padWidth + x]) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const ny = y + dy;
                            const nx = x + dx;
                            if (nx >= 0 && nx < padWidth && ny >= 0 && ny < padHeight) {
                                dilatedMask[ny * padWidth + nx] = 1;
                            }
                        }
                    }
                }
            }
        }

        // Set strength for all non-underflow pixels in dilatedMask
        for (let y = 0; y < padHeight; y++) {
            for (let x = 0; x < padWidth; x++) {
                const idx = y * padWidth + x;
                if (dilatedMask[idx] && strengthMap[idx] !== 1.0) {
                    const isTemplatePixel = originalMask[idx] === 1;

                    if (isTemplatePixel) {
                        const wy = y - pad;
                        const wx = x - pad;
                        const alpha = watermark.alphaMap.values[wy * wWidth + wx];
                        strengthMap[idx] = Math.max(baseStrength * alpha, 0.7 * baseStrength);
                    } else {
                        strengthMap[idx] = 0.7 * baseStrength;
                    }
                }
            }
        }

        // 1. Iterative inpainting for underflow pixels (strength === 1.5)
        const underflowWorkMask = new Uint8Array(padWidth * padHeight);
        let hasUnderflow = false;
        for (let i = 0; i < strengthMap.length; i++) {
            if (strengthMap[i] === 1.5) {
                underflowWorkMask[i] = 1;
                hasUnderflow = true;
            }
        }

        if (hasUnderflow) {
            const maxIter = Math.min(60, Math.max(6, Math.round(Math.sqrt(wWidth * wHeight) / 2)));
            const workMask = new Uint8Array(underflowWorkMask);

            for (let iter = 0; iter < maxIter; iter++) {
                let changes = 0;
                const nextMask = new Uint8Array(workMask);

                for (let y = 0; y < padHeight; y++) {
                    for (let x = 0; x < padWidth; x++) {
                        if (!workMask[y * padWidth + x]) continue;

                        const py = watermark.y - pad + y;
                        const px = watermark.x - pad + x;
                        if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) continue;

                        let neighborCount = 0;
                        const neighborColors = [0, 0, 0];

                        // Gather non-underflow neighbors (boundary-safe loop)
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nx = x + dx;
                                const ny = y + dy;

                                const fX = watermark.x - pad + nx;
                                const fY = watermark.y - pad + ny;

                                if (fX >= 0 && fX < imageData.width && fY >= 0 && fY < imageData.height) {
                                    let isNeighborInMask = false;
                                    if (nx >= 0 && nx < padWidth && ny >= 0 && ny < padHeight) {
                                        if (workMask[ny * padWidth + nx]) {
                                            isNeighborInMask = true;
                                        }
                                    }
                                    if (!isNeighborInMask) {
                                        const offset = (fY * imageData.width + fX) * 4;
                                        neighborColors[0] += data[offset];
                                        neighborColors[1] += data[offset + 1];
                                        neighborColors[2] += data[offset + 2];
                                        neighborCount++;
                                    }
                                }
                            }
                        }

                        if (neighborCount === 0) continue;

                        const offset = (py * imageData.width + px) * 4;
                        for (let c = 0; c < 3; c++) {
                            data[offset + c] = Math.round(neighborColors[c] / neighborCount);
                        }

                        nextMask[y * padWidth + x] = 0;
                        changes++;
                    }
                }

                workMask.set(nextMask);
                if (changes === 0) break;
            }
        }

        // 2. Smoothing/blending pass for other pixels in dilatedMask (0 < strength < 1.0)
        const outputData = new Uint8ClampedArray(data);

        for (let y = 0; y < padHeight; y++) {
            for (let x = 0; x < padWidth; x++) {
                const idx = y * padWidth + x;
                const strength = strengthMap[idx];

                // Only smooth pixels with 0 < strength < 1.5
                if (strength <= 0 || strength >= 1.5) continue;

                const py = watermark.y - pad + y;
                const px = watermark.x - pad + x;
                if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) continue;

                let neighborSum = [0, 0, 0];
                let neighborCount = 0;

                // Boundary-safe gathering of neighbors: prioritize non-mask pixels
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;

                        const fX = watermark.x - pad + nx;
                        const fY = watermark.y - pad + ny;

                        if (fX >= 0 && fX < imageData.width && fY >= 0 && fY < imageData.height) {
                            let isNeighborMask = false;
                            if (nx >= 0 && nx < padWidth && ny >= 0 && ny < padHeight) {
                                if (dilatedMask[ny * padWidth + nx] === 1) {
                                    isNeighborMask = true;
                                }
                            }
                            if (!isNeighborMask) {
                                const nOff = (fY * imageData.width + fX) * 4;
                                neighborSum[0] += data[nOff];
                                neighborSum[1] += data[nOff + 1];
                                neighborSum[2] += data[nOff + 2];
                                neighborCount++;
                            }
                        }
                    }
                }

                // Fallback: if no non-mask neighbors found, gather any neighbor on canvas
                if (neighborCount === 0) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;

                            const fX = watermark.x - pad + nx;
                            const fY = watermark.y - pad + ny;

                            if (fX >= 0 && fX < imageData.width && fY >= 0 && fY < imageData.height) {
                                const nOff = (fY * imageData.width + fX) * 4;
                                neighborSum[0] += data[nOff];
                                neighborSum[1] += data[nOff + 1];
                                neighborSum[2] += data[nOff + 2];
                                neighborCount++;
                            }
                        }
                    }
                }

                if (neighborCount > 0) {
                    const offset = (py * imageData.width + px) * 4;
                    for (let c = 0; c < 3; c++) {
                        const avg = neighborSum[c] / neighborCount;
                        // Blend unblended data with neighbor average based on strength
                        outputData[offset + c] = Math.round(unblendedData[offset + c] * (1 - strength) + avg * strength);
                    }
                }
            }
        }

        data.set(outputData);
    }

    // Step 3: Flat background fill - sample larger surrounding area and blend
    // edge pixels towards background average to eliminate residual ghost outlines
    const bgLuminance = calculateBackgroundBrightness(imageData, watermark);
    if (bgLuminance !== null) {
        // Sample a large area around the watermark for background reference
        const samplePad = Math.max(15, Math.round(wWidth * 0.5));
        let bgSum = [0, 0, 0];
        let bgCount = 0;
        
        for (let dy = -samplePad; dy <= wHeight + samplePad; dy++) {
            for (let dx = -samplePad; dx <= wWidth + samplePad; dx++) {
                // Skip the watermark area itself
                if (dy >= 0 && dy < wHeight && dx >= 0 && dx < wWidth) continue;
                
                const py = watermark.y + dy;
                const px = watermark.x + dx;
                if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) continue;
                
                const offset = (py * imageData.width + px) * 4;
                bgSum[0] += data[offset];
                bgSum[1] += data[offset + 1];
                bgSum[2] += data[offset + 2];
                bgCount++;
            }
        }
        
        if (bgCount > 0) {
            const bgAvg = [bgSum[0] / bgCount, bgSum[1] / bgCount, bgSum[2] / bgCount];

            // Dilate the fill mask a few pixels beyond the template shape so the
            // anti-aliased rim just outside the star gets flattened too
            const fillRadius = 4;
            const fillMask = new Float32Array(wWidth * wHeight);
            for (let y = 0; y < wHeight; y++) {
                for (let x = 0; x < wWidth; x++) {
                    const a = watermark.alphaMap.values[y * wWidth + x];
                    if (a <= 0.04) continue;
                    for (let dy = -fillRadius; dy <= fillRadius; dy++) {
                        for (let dx = -fillRadius; dx <= fillRadius; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx < 0 || nx >= wWidth || ny < 0 || ny >= wHeight) continue;
                            const i2 = ny * wWidth + nx;
                            if (a > fillMask[i2]) fillMask[i2] = a;
                        }
                    }
                }
            }

            // For each watermark pixel, check if it's still significantly different
            // from background. Check PER-CHANNEL (not just luminance) to catch
            // color mismatches that luminance-based diff would miss.
            for (let y = 0; y < wHeight; y++) {
                for (let x = 0; x < wWidth; x++) {
                    const idx = y * wWidth + x;
                    const alpha = fillMask[idx];
                    if (alpha <= 0.04) continue;
                    
                    const px = watermark.x + x;
                    const py = watermark.y + y;
                    if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) continue;
                    
                    const offset = (py * imageData.width + px) * 4;
                    
                    // Per-channel difference check — catches color mismatches
                    // that luminance-only diff would miss
                    const rDiff = Math.abs(data[offset] - bgAvg[0]);
                    const gDiff = Math.abs(data[offset + 1] - bgAvg[1]);
                    const bDiff = Math.abs(data[offset + 2] - bgAvg[2]);
                    
                    // Blend if any channel differs by more than 2, OR if alpha is significant
                    // (center pixels get filled regardless to guarantee uniform background)
                    if (rDiff > 2 || gDiff > 2 || bDiff > 2 || alpha > 0.60) {
                        // Pixels clearly off-background get fully replaced; borderline
                        // pixels blend by alpha so texture is preserved at the edges
                        const maxDiff = Math.max(rDiff, gDiff, bDiff);
                        const blendStrength = (maxDiff > 4 || alpha > 0.30)
                            ? 1.0
                            : Math.min(0.97, 0.50 + alpha * 0.47);
                        for (let c = 0; c < 3; c++) {
                            data[offset + c] = Math.round(data[offset + c] * (1 - blendStrength) + bgAvg[c] * blendStrength);
                        }
                    }
                }
            }
        }
    }

    return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Veo per-frame, per-channel opacity solver: bisects for the opacity whose
 * unblended residual (one color channel) has zero correlation with the
 * template alpha. A positive correlation means the mark is still visible
 * (under-subtraction), negative means a dark imprint (over-subtraction).
 * Solving per channel also removes chroma ghosts — a luma-only solve leaves
 * a colored imprint when the effective blend differs per channel (H.264
 * chroma subsampling). No background model needed. Falls back to the band
 * endpoint with the smaller |correlation| when the zero lies outside [lo, hi].
 */
function findZeroResidualOpacity(imageData, watermark, lo, hi, channel) {
    const wWidth = watermark.alphaMap.width;
    const wHeight = watermark.alphaMap.height;
    const values = watermark.alphaMap.values;
    const wColor = watermark.overlayValue ?? 250;
    const baseStrength = watermark.baseStrength ?? 1.0;

    const residCorr = (opacity) => {
        let n = 0, sumA = 0, sumL = 0, sumAL = 0, sumAA = 0, sumLL = 0;
        for (let y = 0; y < wHeight; y++) {
            for (let x = 0; x < wWidth; x++) {
                const idx = y * wWidth + x;
                const a = values[idx];
                const p = Math.min(a * baseStrength * opacity, 1.0);
                const invP = 1 - p;
                const off = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
                let l = imageData.data[off + channel];
                if (p >= 0.002 && invP > 0.0001) {
                    l = clamp((l - p * wColor) / invP, 0, 255);
                }
                n++; sumA += a; sumL += l; sumAL += a * l; sumAA += a * a; sumLL += l * l;
            }
        }
        const cov = sumAL - sumA * sumL / n;
        const den = Math.sqrt((sumAA - sumA * sumA / n) * (sumLL - sumL * sumL / n));
        return den > 1e-6 ? cov / den : 0;
    };

    const cLo = residCorr(lo);
    const cHi = residCorr(hi);
    if (!(cLo > 0 && cHi < 0)) {
        return Math.abs(cLo) <= Math.abs(cHi) ? lo : hi;
    }
    let a = lo, b = hi;
    for (let i = 0; i < 14; i++) {
        const mid = (a + b) / 2;
        if (residCorr(mid) > 0) a = mid; else b = mid;
    }
    return (a + b) / 2;
}

/**
 * Reference-exact frame cleaner for video: alpha-inverse unblend, then optional
 * edge diffusion cleanup constrained to the template box. No background fill.
 */
function cleanVideoFrameWatermark(imageData, watermark) {
    const data = new Uint8ClampedArray(imageData.data);
    let opacity = watermark.opacity !== undefined
        ? watermark.opacity
        : evaluateOpacityScores(imageData, watermark).opacity;
    // Veo: H.264 quantization makes the effective blend drift frame to frame
    // and channel to channel, leaving bright/dark/colored wordmark residue on
    // frames far from the detection window. Solve per frame and per channel
    // for the opacity whose unblend residual has zero correlation with the
    // template alpha, banded around the locked opacity (fix-veo-residual-ghost).
    let channelOpacity = null;
    if (watermark.isVeo && watermark.opacity !== undefined) {
        const lo = Math.max(0.40, watermark.opacity - 0.15);
        const hi = Math.min(0.95, watermark.opacity + 0.25);
        channelOpacity = [0, 1, 2].map(c => findZeroResidualOpacity(imageData, watermark, lo, hi, c));
    }
    const ceiling = watermark.ceiling ?? 1.0;
    const isColor = watermark.alphaMap.colorValues !== undefined;
    const colors = watermark.alphaMap.colorValues;
    const overlayValue = watermark.overlayValue ?? 250;
    const wWidth = watermark.alphaMap.width;
    const wHeight = watermark.alphaMap.height;
    const mask = watermark.edgeCleanup ? new Uint8Array(wWidth * wHeight) : null;

    // Step 1: pixel unblending (alpha-inverse compositing)
    for (let y = 0; y < wHeight; y++) {
        for (let x = 0; x < wWidth; x++) {
            const idx = y * wWidth + x;
            const alphaVal = watermark.alphaMap.values[idx] * watermark.baseStrength;
            const p = Math.min(alphaVal * opacity, ceiling);
            if (!channelOpacity && p < 0.002) continue;
            if (channelOpacity && alphaVal * Math.max(...channelOpacity) < 0.002) continue;

            const pxOffset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;

            if (mask) mask[idx] = 1;
            for (let c = 0; c < 3; c++) {
                const pc = channelOpacity ? Math.min(alphaVal * channelOpacity[c], ceiling) : p;
                const invP = 1 - pc;
                if (pc < 0.002 || invP <= 0.0001) continue;
                const wColor = isColor && colors ? colors[3 * idx + c] : overlayValue;
                data[pxOffset + c] = Math.round(clamp((imageData.data[pxOffset + c] - pc * wColor) / invP, 0, 255));
            }
        }
    }

    // Step 1b (Veo): despeckle the unblended region. Unblending divides by
    // (1 - p) ≈ 0.38, amplifying H.264 noise ~2.6x — visible as dark/bright
    // mottling on flat backgrounds. Median-clamp outliers only (salt-pepper
    // style), so real texture within tolerance is untouched
    // (fix-veo-residual-ghost).
    if (channelOpacity) {
        const values = watermark.alphaMap.values;
        const nine = new Array(9);
        for (let pass = 0; pass < 2; pass++) {
            const snapshot = new Uint8ClampedArray(data);
            for (let y = 0; y < wHeight; y++) {
                for (let x = 0; x < wWidth; x++) {
                    if (values[y * wWidth + x] < 0.08) continue;
                    const px = watermark.x + x, py = watermark.y + y;
                    if (px < 1 || px >= imageData.width - 1 || py < 1 || py >= imageData.height - 1) continue;
                    const off = (py * imageData.width + px) * 4;
                    for (let c = 0; c < 3; c++) {
                        let k = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                nine[k++] = snapshot[((py + dy) * imageData.width + (px + dx)) * 4 + c];
                            }
                        }
                        nine.sort((a, b) => a - b);
                        const med = nine[4];
                        if (Math.abs(data[off + c] - med) > 6) data[off + c] = med;
                    }
                }
            }
        }
    }

    // Step 2: edge diffusion cleanup (only enabled for full-opacity grayscale overlays)
    if (watermark.edgeCleanup && mask) {
        const { strength, radius } = watermark.edgeCleanup;

        const dilated = new Uint8Array(wWidth * wHeight);
        for (let y = 0; y < wHeight; y++) {
            for (let x = 0; x < wWidth; x++) {
                if (!mask[y * wWidth + x]) continue;
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < wWidth && ny >= 0 && ny < wHeight) {
                            dilated[ny * wWidth + nx] = 1;
                        }
                    }
                }
            }
        }

        const workMask = new Uint8Array(dilated);
        const maxIter = Math.min(120, Math.max(8, wWidth + wHeight));
        for (let iter = 0; iter < maxIter; iter++) {
            let changes = 0;
            const nextMask = new Uint8Array(workMask);

            for (let y = 0; y < wHeight; y++) {
                for (let x = 0; x < wWidth; x++) {
                    if (!workMask[y * wWidth + x]) continue;

                    let neighborCount = 0;
                    const neighborSum = [0, 0, 0];
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx < 0 || nx >= wWidth || ny < 0 || ny >= wHeight) continue;
                            if (workMask[ny * wWidth + nx]) continue;
                            const nOffset = ((watermark.y + ny) * imageData.width + watermark.x + nx) * 4;
                            neighborSum[0] += data[nOffset];
                            neighborSum[1] += data[nOffset + 1];
                            neighborSum[2] += data[nOffset + 2];
                            neighborCount++;
                        }
                    }
                    if (neighborCount === 0) continue;

                    const offset = ((watermark.y + y) * imageData.width + watermark.x + x) * 4;
                    for (let c = 0; c < 3; c++) {
                        const avg = neighborSum[c] / neighborCount;
                        data[offset + c] = Math.round(data[offset + c] * (1 - strength) + avg * strength);
                    }
                    nextMask[y * wWidth + x] = 0;
                    changes++;
                }
            }

            workMask.set(nextMask);
            if (changes === 0) break;
        }
    }

    return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Resolves the codec config box (description) for VideoDecoder
 */
function getCodecDescription(file, track) {
    const boxTrack = file.getTrackById(track.id);
    for (const entry of boxTrack.mdia?.minf?.stbl?.stsd?.entries || []) {
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (!box) continue;
        const DataStream = window.DataStream;
        if (!DataStream) break;
        const ds = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(ds);
        return new Uint8Array(ds.buffer, 8); // Skip the first 8 bytes of box header
    }
    return null;
}

/**
 * Main async process for cleaning watermarks from video file array buffer
 */
export async function processVideoWatermark(fileArrayBuffer, mode, opacityMode, onProgress) {
    if (typeof VideoDecoder === "undefined" || typeof VideoEncoder === "undefined") {
        throw new Error("This browser does not support WebCodecs video processing. Please use a recent Chromium-based browser (Chrome or Edge).");
    }

    // Reset for new video
    onProgress({ stage: "demux", ratio: 0 });

    // Step 1: Parse and Demux MP4
    const file = window.MP4Box.createFile();
    const videoSamples = [];
    const audioSamples = [];
    let videoTrack = null;
    let audioTrack = null;

    const demuxPromise = new Promise((resolve, reject) => {
        file.onError = (err) => reject(new Error(`MP4 parsing failed: ${err}`));
        file.onReady = (info) => {
            videoTrack = info.videoTracks?.[0];
            audioTrack = info.audioTracks?.[0];
            if (videoTrack) {
                file.setExtractionOptions(videoTrack.id, "video", { nbSamples: 1000000 });
                if (audioTrack) {
                    file.setExtractionOptions(audioTrack.id, "audio", { nbSamples: 1000000 });
                }
                file.start();
                resolve(info);
            } else {
                reject(new Error("No valid video track found in the uploaded MP4."));
            }
        };

        file.onSamples = (id, type, samples) => {
            const targetSamples = (type === "video") ? videoSamples : audioSamples;
            for (const sample of samples) {
                targetSamples.push({
                    ...sample,
                    data: sample.data.slice(0) // copy arraybuffer
                });
            }
        };
    });

    const fileBufferCopy = fileArrayBuffer.slice(0);
    fileBufferCopy.fileStart = 0;
    file.appendBuffer(fileBufferCopy);
    file.flush();

    // Wait for MP4Box metadata (propagates parse errors); timeout guards stalled parse
    await Promise.race([
        demuxPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("MP4 metadata parsing timed out. The file may be corrupt or not a valid MP4.")), 10000))
    ]);
    // Let synchronously-queued sample callbacks settle
    await new Promise(r => setTimeout(r, 50));

    if (!videoTrack) {
        throw new Error("No video track could be parsed from the file.");
    }

    onProgress({ stage: "demux", ratio: 1.0 });

    const width = videoTrack.video.width;
    const height = videoTrack.video.height;
    const totalSamples = videoSamples.length || 1;
    const timescale = videoSamples[0]?.timescale ?? videoTrack.timescale ?? 30000;
    
    const avgDuration = videoSamples.reduce((sum, s) => sum + s.duration, 0) / totalSamples || timescale / 30;
    // Clamp: zero-duration samples would give Infinity, poisoning the encoder
    // config and keyframe interval
    const rawFrameRate = Math.round(timescale / avgDuration);
    const frameRate = clamp(Number.isFinite(rawFrameRate) ? rawFrameRate : 30, 1, 240);

    const is1080p = (width === 1920 && height === 1080) || (width === 1080 && height === 1920);

    // Step 2: Load matching watermark asset.
    // 1080p uses the colored paired-star overlay (84px); everything else uses bg_48.png grayscale.
    const isPortrait = height > width;
    const area = width * height;
    // 1080p and above (incl. 4K) use the 1080p template family, scaled by width ratio
    const use1080pFamily = is1080p || area >= 1920 * 1080 ||
        Math.abs(area - 1920 * 1080) < Math.abs(area - 1280 * 720);

    const refWidth = use1080pFamily ? (isPortrait ? 1080 : 1920) : (isPortrait ? 720 : 1280);
    const scale = width / refWidth;

    const isVeo = mode === "veo";
    let watermarkUrl, isColor, targetWWidth, targetWHeight;
    if (isVeo) {
        // Veo "Veo" text wordmark, bottom-right, semi-transparent white.
        // Templates extracted from real Veo output: 29x17 at 720p (mark core
        // ~21x9 + 4px anti-alias pad), alpha pre-divided by 0.62 so the 0.62
        // opacity candidate reproduces the true blend exactly.
        watermarkUrl = use1080pFamily ? "watermarks/veo-1080p-overlay.png" : "watermarks/veo-720p-overlay.png";
        isColor = false;
        const baseW = use1080pFamily ? 44 : 29;
        const baseH = use1080pFamily ? 26 : 17;
        targetWWidth = Math.max(12, Math.round(baseW * scale));
        targetWHeight = Math.max(7, Math.round(baseH * scale));
    } else {
        watermarkUrl = use1080pFamily ? "watermarks/gemini-star_paired_star_overlay.png" : "watermarks/bg_48.png";
        isColor = use1080pFamily;
        const baseWSize = use1080pFamily ? 84 : 48;
        targetWWidth = Math.max(16, Math.round(baseWSize * scale));
        targetWHeight = targetWWidth;
    }

    const alphaMap = await loadWatermarkMap(watermarkUrl, targetWWidth, targetWHeight, isColor);

    let candidates;
    if (isVeo) {
        // Corner-margin guesses (x, y from bottom-right); measured margin is
        // 12px at 720p (16px to mark core, minus 4px template pad). Template
        // search in lockWatermarkAndFlush refines if none correlates well
        const baseMargin = use1080pFamily ? 18 : 12;
        const cornerOffsets = [[baseMargin, baseMargin], [baseMargin - 4, baseMargin - 4], [baseMargin + 4, baseMargin + 4], [baseMargin + 12, baseMargin + 12], [0, 0]];
        candidates = cornerOffsets.map(([ox, oy]) => ({
            x: clamp(width - alphaMap.width - Math.round(ox * scale), 0, width - alphaMap.width),
            y: clamp(height - alphaMap.height - Math.round(oy * scale), 0, height - alphaMap.height),
            alphaMap,
            score: 0,
            baseStrength: 1.0,
            isVeo: true
        }));
    } else {
        const baseOffsets = use1080pFamily ? RESOLUTION_OFFSETS_1080P : RESOLUTION_OFFSETS_720P;
        const scaledOffsets = baseOffsets.map(offset => Math.round(offset * scale));
        candidates = scaledOffsets.map(offset => ({
            x: clamp(width - offset, 0, width - alphaMap.width),
            y: clamp(height - offset, 0, height - alphaMap.height),
            alphaMap,
            score: 0,
            baseStrength: 1.0
        }));
    }
    let selectedWatermark = null;

    // Step 3: Setup Mp4 Muxer
    const muxer = new window.Mp4Muxer.Muxer({
        target: new window.Mp4Muxer.ArrayBufferTarget(),
        fastStart: "in-memory",
        firstTimestampBehavior: "offset",
        video: {
            codec: "avc",
            width,
            height
        },
        audio: audioTrack ? {
            codec: "aac",
            sampleRate: audioTrack.audio.sample_rate,
            numberOfChannels: audioTrack.audio.channel_count
        } : undefined
    });

    // Step 4: Setup WebCodecs Encoder
    // H.264 level must cover the resolution: Level 4.0 tops out around 1080p,
    // 4K (3840x2160 / 2160x3840) requires Level 5.1
    const is4K = width * height > 1920 * 1088;
    const highProfileCodec = is4K ? "avc1.640033" : "avc1.640028";
    const baselineCodec = is4K ? "avc1.420033" : "avc1.42001f";
    const bitrateCeiling = is4K ? 80000000 : 40000000;
    const targetBitrate = Math.max(8000000, Math.min(bitrateCeiling, Math.round(width * height * frameRate * 0.30)));
    let encoderConfig = {
        codec: highProfileCodec, // H.264 High Profile
        width,
        height,
        bitrate: targetBitrate,
        framerate: frameRate,
        latencyMode: "quality",
        avc: { format: "avc" }
    };

    let encoderSupported = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!encoderSupported.supported) {
        // Fallback to Baseline Profile
        encoderConfig = {
            ...encoderConfig,
            codec: baselineCodec
        };
        encoderSupported = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!encoderSupported.supported) {
            throw new Error("This browser does not support H.264 video encoding at this resolution.");
        }
    }

    let encodingError = null;
    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            muxer.addVideoChunk(chunk, metadata);
        },
        error: (err) => {
            encodingError = err;
            console.error("VideoEncoder error:", err);
        }
    });
    encoder.configure(encoderConfig);

    // Step 5: Setup WebCodecs Decoder
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const canvasCtx = getCanvasContext(canvas);

    // Detection window: correlate candidates over the first frames, then lock.
    // Extended (up to a memory-bounded cap) when the early frames carry no
    // signal — fade-in intros would otherwise trigger a false "re-encoded
    // video" rejection on originals downloaded straight from Gemini.
    let detectionFrameTarget = Math.min(5, totalSamples);
    const maxDetectionFrames = Math.min(totalSamples, clamp(Math.floor(150000000 / (width * height * 4)), 5, 30));

    let decodeError = null;
    let detectionFramesSeen = 0;
    let framesProcessed = 0;
    const accumulatedFrames = [];

    const lockWatermarkAndFlush = (isFinal = false) => {
        // Pick candidate: best must beat the default by a per-frame threshold
        const defaultCand = candidates[0];
        const bestCand = candidates.reduce((a, b) => (b.score > a.score ? b : a));
        const threshold = 0.04 * Math.max(1, detectionFramesSeen);
        selectedWatermark = bestCand.score >= defaultCand.score + threshold ? bestCand : defaultCand;

        // Fallback: fixed corner offsets can miss on portrait/4K variants. If no
        // fixed candidate correlates well, run a full template search on a
        // buffered frame and take that position when it is clearly stronger.
        const avgBestScore = bestCand.score / Math.max(1, detectionFramesSeen);
        let detectionQuality = avgBestScore;
        if (avgBestScore < 0.35 && accumulatedFrames.length > 0) {
            const searchFrame = accumulatedFrames[accumulatedFrames.length - 1].imageData;
            const searchWindow = Math.round(350 * Math.max(1, scale));
            const searched = findBestMatch(searchFrame, alphaMap, isColor, searchWindow);
            if (searched.score > avgBestScore + 0.08) {
                console.log(`Template search override: x=${searched.x}, y=${searched.y} (corr=${searched.score.toFixed(3)} vs fixed ${avgBestScore.toFixed(3)})`);
                selectedWatermark = { x: searched.x, y: searched.y, alphaMap, score: searched.score, baseStrength: 1.0, isVeo };
            }
            detectionQuality = Math.max(detectionQuality, searched.score);
        }

        // Re-encoded videos (WhatsApp, social media) destroy the watermark
        // signature — removal would only smear pixels. Refuse with guidance.
        if (detectionQuality < 0.15) {
            // Weak signal in the first frames is often a fade-in / flat intro,
            // not a re-encoded video. Buffer more frames and retry before refusing.
            if (!isFinal && detectionFramesSeen < maxDetectionFrames) {
                selectedWatermark = null;
                detectionFrameTarget = Math.min(maxDetectionFrames, detectionFramesSeen + 5);
                console.log(`Weak watermark signal (${detectionQuality.toFixed(3)}) after ${detectionFramesSeen} frames; extending detection window to ${detectionFrameTarget}`);
                return;
            }
            const brand = isVeo ? "Veo" : "Gemini";
            const source = isVeo ? "Veo / Flow" : "Gemini";
            throw new Error(`No ${brand} watermark detected in this video. Videos re-encoded by WhatsApp, Telegram, or social media cannot be cleaned reliably. Please upload the original MP4 downloaded directly from ${source}.`);
        }

        // Estimate opacity over the buffered frames
        const opacityDetails = findBestOpacity(accumulatedFrames, selectedWatermark);

        // Colored overlays and auto mode use the estimate; normal forces 1.0, soft forces 0.62
        selectedWatermark.opacity = (alphaMap.colorValues !== undefined || opacityMode === "auto")
            ? opacityDetails.opacity
            : (opacityMode === "normal" ? 1.0 : 0.62);

        // Full-opacity grayscale overlays: unblend saturates, so cap the alpha
        // and diffuse the edges to hide quantization residue
        if (selectedWatermark.opacity >= 1 && alphaMap.colorValues === undefined) {
            selectedWatermark.overlayValue = 255;
            selectedWatermark.ceiling = 0.99;
            selectedWatermark.edgeCleanup = { strength: 0.6, radius: 2 };
        }

        console.log(`Watermark locked at x=${selectedWatermark.x}, y=${selectedWatermark.y}, opacity=${selectedWatermark.opacity}`);

        // Process all buffered frames now that coordinates are locked
        for (const af of accumulatedFrames) {
            encodeCleanedFrame(af);
        }
        accumulatedFrames.length = 0; // free memory
    };

    const processFrame = (decodedFrame) => {
        const timestamp = decodedFrame.timestamp;
        const duration = decodedFrame.duration;

        // Render decoded frame to canvas
        canvasCtx.drawImage(decodedFrame, 0, 0, width, height);
        decodedFrame.close();

        const imgData = canvasCtx.getImageData(0, 0, width, height);
        const frameData = {
            imageData: imgData,
            timestamp,
            duration
        };

        // If watermark coordinates are not selected yet, accumulate correlation over first frames
        if (!selectedWatermark) {
            for (const cand of candidates) {
                cand.score += calculateWatermarkCorrelation(imgData, cand);
            }
            accumulatedFrames.push(frameData);
            detectionFramesSeen++;

            if (detectionFramesSeen >= detectionFrameTarget) {
                lockWatermarkAndFlush();
            }
            return;
        }

        // Standard workflow once coordinates are locked
        encodeCleanedFrame(frameData);
    };

    const encodeCleanedFrame = (frameData) => {
        const cleanedImgData = cleanVideoFrameWatermark(frameData.imageData, selectedWatermark || candidates[0]);
        
        const videoFrameInit = {
            format: "RGBA",
            codedWidth: width,
            codedHeight: height,
            timestamp: frameData.timestamp
        };
        if (frameData.duration !== null && frameData.duration !== undefined) {
            videoFrameInit.duration = frameData.duration;
        }

        const outFrame = new VideoFrame(cleanedImgData.data.buffer, videoFrameInit);
        
        // Keyframe every 2 seconds
        const keyframeInterval = Math.max(1, frameRate * 2);
        const isKeyFrame = (framesProcessed % keyframeInterval === 0);

        encoder.encode(outFrame, { keyFrame: isKeyFrame });
        outFrame.close();

        framesProcessed++;
        onProgress({
            stage: "process",
            ratio: framesProcessed / totalSamples
        });
    };

    const decoder = new VideoDecoder({
        output: (frame) => {
            try {
                processFrame(frame);
            } catch (err) {
                decodeError = err;
                console.error("Frame processing error:", err);
                frame.close();
            }
        },
        error: (err) => {
            decodeError = err;
            console.error("VideoDecoder error:", err);
        }
    });

    const descriptionBuffer = getCodecDescription(file, videoTrack);
    decoder.configure({
        codec: videoTrack.codec,
        codedWidth: width,
        codedHeight: height,
        description: descriptionBuffer || undefined
    });

    onProgress({ stage: "process", ratio: 0 });

    // Step 6: Decode the samples in order.
    // try/finally ensures the hardware decoder/encoder are always released —
    // an error mid-run (e.g. "no watermark detected") would otherwise leak
    // codec instances and make follow-up attempts fail.
    try {
        for (let i = 0; i < videoSamples.length; i++) {
            if (decodeError) throw decodeError;
            if (encodingError) throw encodingError;

            const sample = videoSamples[i];
            decoder.decode(new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp: 1000000 * sample.cts / sample.timescale,
                duration: 1000000 * sample.duration / sample.timescale,
                data: sample.data
            }));

            // Yield execution back to browser periodically to keep page responsive
            if (i % 24 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        await decoder.flush();

        // Short videos: fewer frames than the detection window — lock with what we have
        if (!selectedWatermark && accumulatedFrames.length > 0) {
            lockWatermarkAndFlush(true);
        }

        await encoder.flush();

        if (decodeError) throw decodeError;
        if (encodingError) throw encodingError;
    } finally {
        try { if (decoder.state !== "closed") decoder.close(); } catch (e) { /* already closed */ }
        try { if (encoder.state !== "closed") encoder.close(); } catch (e) { /* already closed */ }
    }

    // Step 7: Pass through audio track samples directly
    if (audioTrack && audioSamples.length > 0) {
        try {
            const samplingRate = audioTrack.audio.sample_rate;
            const channelCount = audioTrack.audio.channel_count;

            // Generate AAC Audio Specific Config
            const rateIndex = [
                96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 
                16000, 12000, 11025, 8000, 7350
            ].indexOf(samplingRate);
            const actualRateIdx = rateIndex >= 0 ? rateIndex : 4;
            const audioConfig = {
                decoderConfig: {
                    codec: "mp4a.40.2",
                    sampleRate: samplingRate,
                    numberOfChannels: channelCount,
                    description: new Uint8Array([
                        16 | (actualRateIdx >> 1), 
                        ((actualRateIdx & 1) << 7) | (channelCount << 3)
                    ])
                }
            };

            for (const sample of audioSamples) {
                muxer.addAudioChunk(new EncodedAudioChunk({
                    type: "key",
                    timestamp: 1000000 * sample.cts / sample.timescale,
                    duration: 1000000 * sample.duration / sample.timescale,
                    data: sample.data
                }), audioConfig);
            }
        } catch (err) {
            console.warn("Audio track passthrough failed; exporting video-only MP4:", err);
        }
    }

    // Step 8: Finalize Muxing
    onProgress({ stage: "mux", ratio: 0.95 });
    muxer.finalize();
    onProgress({ stage: "done", ratio: 1.0 });

    const outputBuffer = muxer.target.buffer;
    return new Blob([outputBuffer], { type: "video/mp4" });
}

/**
 * Calculates correlation coefficient at a specific (x, y) coordinate
 */
function calculateWatermarkCorrelationAt(imageData, alphaMap, x, y) {
    let frameSum = 0;
    let frameSqSum = 0;
    let templateSum = 0;
    let templateSqSum = 0;
    let crossSum = 0;
    let count = 0;

    const width = alphaMap.width;
    const height = alphaMap.height;

    for (let ty = 0; ty < height; ty++) {
        for (let tx = 0; tx < width; tx++) {
            const templateAlpha = alphaMap.values[ty * width + tx];
            if (templateAlpha <= 0.08) continue;

            const pixelOffset = ((y + ty) * imageData.width + (x + tx)) * 4;
            if (pixelOffset < 0 || pixelOffset >= imageData.data.length) continue;
            
            const luminance = (imageData.data[pixelOffset] + imageData.data[pixelOffset + 1] + imageData.data[pixelOffset + 2]) / 765;

            frameSum += luminance;
            frameSqSum += luminance * luminance;
            templateSum += templateAlpha;
            templateSqSum += templateAlpha * templateAlpha;
            crossSum += luminance * templateAlpha;
            count++;
        }
    }

    if (count === 0) return -Infinity;

    const meanFrame = frameSum / count;
    const meanTemplate = templateSum / count;
    const stdDenominator = Math.sqrt((frameSqSum - count * meanFrame * meanFrame) * (templateSqSum - count * meanTemplate * meanTemplate));

    if (stdDenominator <= 0) return -Infinity;

    return (crossSum - count * meanFrame * meanTemplate) / stdDenominator;
}

/**
 * Searches for best watermark template location coarse-to-fine
 */
function findBestMatch(imageData, alphaMap, isColor, searchWindow = 350) {
    const width = imageData.width;
    const height = imageData.height;
    const tWidth = alphaMap.width;
    const tHeight = alphaMap.height;

    const xMin = Math.max(0, width - searchWindow);
    const xMax = width - tWidth;
    const yMin = Math.max(0, height - searchWindow);
    const yMax = height - tHeight;

    let bestScore = -Infinity;
    let bestX = xMax;
    let bestY = yMax;

    // Coarse scan: step = 4
    let coarseBestScore = -Infinity;
    let coarseBestX = xMax;
    let coarseBestY = yMax;

    for (let y = yMin; y < yMax; y += 4) {
        for (let x = xMin; x < xMax; x += 4) {
            const score = calculateWatermarkCorrelationAt(imageData, alphaMap, x, y);
            if (score > coarseBestScore) {
                coarseBestScore = score;
                coarseBestX = x;
                coarseBestY = y;
            }
        }
    }

    // Fine scan: step = 1
    for (let y = Math.max(yMin, coarseBestY - 6); y <= Math.min(yMax, coarseBestY + 6); y++) {
        for (let x = Math.max(xMin, coarseBestX - 6); x <= Math.min(xMax, coarseBestX + 6); x++) {
            const score = calculateWatermarkCorrelationAt(imageData, alphaMap, x, y);
            if (score > bestScore) {
                bestScore = score;
                bestX = x;
                bestY = y;
            }
        }
    }

    return { x: bestX, y: bestY, score: bestScore };
}

/**
 * Estimate the per-channel overlay color of a watermark by examining
 * the brightest pixels (high alpha, high brightness) in the watermark area.
 * This gives a more accurate overlay color than assuming pure white (255).
 */
function estimateOverlayColor(imageData, watermark) {
    const wWidth = watermark.alphaMap.width;
    const wHeight = watermark.alphaMap.height;
    const startX = watermark.x;
    const startY = watermark.y;
    const overlayValue = watermark.overlayValue ?? 255;
    
    // Collect samples: look at pixels with both high alpha AND high brightness
    let candidates = [];
    
    for (let y = 0; y < wHeight; y++) {
        for (let x = 0; x < wWidth; x++) {
            const idx = y * wWidth + x;
            const alpha = watermark.alphaMap.values[idx];
            if (alpha < 0.30) continue; // Only high-alpha pixels
            
            const px = startX + x;
            const py = startY + y;
            const offset = (py * imageData.width + px) * 4;
            const r = imageData.data[offset];
            const g = imageData.data[offset + 1];
            const b = imageData.data[offset + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            
            candidates.push({ lum, r, g, b, alpha });
        }
    }
    
    if (candidates.length === 0) {
        return [overlayValue, overlayValue, overlayValue];
    }
    
    // Sort by brightness descending, take top 10%
    candidates.sort((a, b) => b.lum - a.lum);
    const topN = Math.max(5, Math.floor(candidates.length * 0.10));
    const top = candidates.slice(0, topN);
    
    // Average the top candidates
    let sumR = 0, sumG = 0, sumB = 0;
    for (const c of top) {
        sumR += c.r;
        sumG += c.g;
        sumB += c.b;
    }
    
    const estimate = [
        Math.round(sumR / top.length),
        Math.round(sumG / top.length),
        Math.round(sumB / top.length)
    ];
    
    console.log(`Overlay color estimate: R=${estimate[0]} G=${estimate[1]} B=${estimate[2]} (from ${topN}/${candidates.length} high-alpha pixels)`);
    return estimate;
}

/**
 * Pads an alpha map with a zero border so cleanup passes can reach the
 * anti-aliased rim just outside the matched template box.
 */
function padAlphaMap(map, pad) {
    const w = map.width + 2 * pad;
    const h = map.height + 2 * pad;
    const values = new Float32Array(w * h);
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            values[(y + pad) * w + (x + pad)] = map.values[y * map.width + x];
        }
    }
    let colorValues;
    if (map.colorValues) {
        colorValues = new Float32Array(w * h * 3);
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const src = 3 * (y * map.width + x);
                const dst = 3 * ((y + pad) * w + (x + pad));
                colorValues[dst] = map.colorValues[src];
                colorValues[dst + 1] = map.colorValues[src + 1];
                colorValues[dst + 2] = map.colorValues[src + 2];
            }
        }
    }
    return { values, colorValues, width: w, height: h };
}

/**
 * Automatically cleans standard corner watermarks on an image
 */
export async function cleanImageWatermarkAuto(canvas, onProgress, opacityMode) {
    const ctx = getCanvasContext(canvas);
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);

    onProgress?.(0.1);

    // Multi-scale template search: the Gemini image watermark size varies
    // relative to image dimensions, so try several template sizes and keep
    // the position/scale with the strongest correlation.
    const minDim = Math.min(width, height);
    const baseScale = minDim / 1024;
    const sizeCandidates = [...new Set(
        [40, 48, 56, 64, 72, 84, 96].map(s => Math.max(32, Math.round(s * baseScale)))
    )];

    const matches = [];
    for (let i = 0; i < sizeCandidates.length; i++) {
        const size = sizeCandidates[i];
        const map = await loadWatermarkMap("watermarks/bg_48.png", size, size, false);
        matches.push({ map, result: findBestMatch(imgData, map, false) });
        onProgress?.(0.1 + 0.5 * ((i + 1) / sizeCandidates.length));
    }
    // Prefer the largest template within a small margin of the best score —
    // an undersized template leaves an untreated rim around the star
    const bestCorr = Math.max(...matches.map(m => m.result.score));
    const chosen = matches
        .filter(m => m.result.score >= bestCorr - 0.04)
        .reduce((a, b) => (b.map.width > a.map.width ? b : a));
    const bgResult = chosen.result;
    const bg48Map = chosen.map;
    const templateSize = bg48Map.width;
    console.log(`Image watermark match: ${templateSize}px template at (${bgResult.x}, ${bgResult.y}), corr=${bgResult.score.toFixed(3)}`);

    onProgress?.(0.6);

    // Pad the matched box so cleanup can also treat the anti-aliased rim just
    // outside the template (the real star is often a few px larger than the match)
    const boxPad = 6;
    const paddedMap = padAlphaMap(bg48Map, boxPad);
    const baseX = bgResult.score > 0.3 ? bgResult.x : Math.max(0, width - templateSize - 10);
    const baseY = bgResult.score > 0.3 ? bgResult.y : Math.max(0, height - templateSize - 10);

    const selected = {
        x: clamp(baseX - boxPad, 0, Math.max(0, width - paddedMap.width)),
        y: clamp(baseY - boxPad, 0, Math.max(0, height - paddedMap.height)),
        alphaMap: paddedMap,
        opacity: 1.0,
        overlayValue: 255,
        baseStrength: 1.0,
        ceiling: 1.0,
        edgeCleanup: { strength: 1.0, radius: 5 }
    };

    // Run opacity estimation using simple brightness matching
    const simpleOpacity = findOptimalOpacitySimple(imgData, selected);
    selected.opacity = simpleOpacity;
    
    // Estimate per-channel overlay color from brightest watermark pixels
    // The watermark overlay may not be pure white; this improves accuracy
    selected.overlayColors = estimateOverlayColor(imgData, selected);
    
    // Apply opacity mode clamping
    if (opacityMode === "soft") {
        selected.opacity = clamp(selected.opacity, 0.30, 0.60);
    } else if (opacityMode === "normal") {
        selected.opacity = clamp(selected.opacity, 0.60, 1.0);
    }

    const cleanedImgData = cleanFrameWatermark(imgData, selected);
    ctx.putImageData(cleanedImgData, 0, 0);

    onProgress?.(1.0);
    return selected;
}

/**
 * Manually cleans an image by performing diffusion inpainting over the masked area
 */
export function cleanImageWatermarkManual(canvas, maskCanvas, onProgress) {
    const ctx = getCanvasContext(canvas);
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);

    const maskCtx = maskCanvas.getContext("2d");
    const maskImgData = maskCtx.getImageData(0, 0, width, height);

    const maskedPixels = [];
    const isMasked = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
        if (maskImgData.data[4 * i + 3] > 10) {
            isMasked[i] = 1;
            maskedPixels.push(i);
        }
    }

    if (maskedPixels.length === 0) {
        onProgress?.(1.0);
        return;
    }

    onProgress?.(0.2);

    const data = imgData.data;

    // Pass 1: onion-peel fill — walk inward from the region boundary, each
    // masked pixel takes the average of its already-filled or unmasked
    // neighbors. Unlike plain relaxation, this discards the painted content
    // immediately instead of letting it bleed back as a blurry blob.
    const workMask = new Uint8Array(isMasked);
    let remaining = maskedPixels.length;
    while (remaining > 0) {
        const nextMask = new Uint8Array(workMask);
        let changes = 0;
        for (const idx of maskedPixels) {
            if (!workMask[idx]) continue;
            const px = idx % width;
            const py = Math.floor(idx / width);

            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = px + dx;
                    const ny = py + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    const nIdx = ny * width + nx;
                    if (workMask[nIdx]) continue;
                    const o = nIdx * 4;
                    rSum += data[o];
                    gSum += data[o + 1];
                    bSum += data[o + 2];
                    count++;
                }
            }
            if (count === 0) continue;

            const o = idx * 4;
            data[o] = Math.round(rSum / count);
            data[o + 1] = Math.round(gSum / count);
            data[o + 2] = Math.round(bSum / count);
            nextMask[idx] = 0;
            changes++;
        }
        if (changes === 0) break;
        remaining -= changes;
        workMask.set(nextMask);
    }

    onProgress?.(0.6);

    // Pass 2: light relaxation to smooth ring artifacts left by the peel
    const smoothIterations = 24;
    const workData = new Uint8ClampedArray(data);
    for (let iter = 0; iter < smoothIterations; iter++) {
        for (let idx of maskedPixels) {
            const px = idx % width;
            const py = Math.floor(idx / width);

            let rSum = 0, gSum = 0, bSum = 0;
            let count = 0;

            const neighbors = [
                { x: px - 1, y: py },
                { x: px + 1, y: py },
                { x: px, y: py - 1 },
                { x: px, y: py + 1 }
            ];

            for (const n of neighbors) {
                if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                    const nIdx = n.y * width + n.x;
                    const offset = nIdx * 4;
                    rSum += workData[offset];
                    gSum += workData[offset + 1];
                    bSum += workData[offset + 2];
                    count++;
                }
            }

            if (count > 0) {
                const offset = idx * 4;
                data[offset] = Math.round(rSum / count);
                data[offset + 1] = Math.round(gSum / count);
                data[offset + 2] = Math.round(bSum / count);
            }
        }
        workData.set(data);
    }

    // Boundary edge smoothing
    for (let idx of maskedPixels) {
        const px = idx % width;
        const py = Math.floor(idx / width);
        
        let isEdge = false;
        const neighbors = [
            { x: px - 1, y: py },
            { x: px + 1, y: py },
            { x: px, y: py - 1 },
            { x: px, y: py + 1 }
        ];
        for (const n of neighbors) {
            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                if (!isMasked[n.y * width + n.x]) {
                    isEdge = true;
                    break;
                }
            }
        }
        
        if (isEdge) {
            const offset = idx * 4;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (const n of neighbors) {
                if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                    const nOffset = (n.y * width + n.x) * 4;
                    rSum += data[nOffset];
                    gSum += data[nOffset + 1];
                    bSum += data[nOffset + 2];
                    count++;
                }
            }
            if (count > 0) {
                data[offset] = Math.round((data[offset] + rSum / count) / 2);
                data[offset + 1] = Math.round((data[offset + 1] + gSum / count) / 2);
                data[offset + 2] = Math.round((data[offset + 2] + bSum / count) / 2);
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    onProgress?.(1.0);
}

