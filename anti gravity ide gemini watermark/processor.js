/**
 * Gemini Video Watermark Remover - Core Processor Engine
 * Fully client-side processing using WebCodecs (VideoDecoder/VideoEncoder), Canvas, MP4Box, and Mp4Muxer.
 */

const SUPPORTED_DIMENSIONS = new Set(["1280x720", "720x1280", "1920x1080", "1080x1920", "848x478", "478x848"]);
const OPACITY_CANDIDATES = [
    1.0, 0.99, 0.98, 0.97, 0.96, 0.95, 0.93, 0.90, 0.88, 0.85, 0.82, 0.80, 0.78, 0.75, 0.72, 0.70, 0.68, 0.65, 0.62, 0.60, 
    0.58, 0.55, 0.52, 0.50, 0.48, 0.45, 0.42, 0.40, 0.38, 0.35, 0.32, 0.30, 
    0.28, 0.25, 0.22, 0.20, 0.18, 0.15, 0.12, 0.10, 0.08, 0.05
];
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
        image.src = url;
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
            // For grayscale overlays, treat grayscale intensity as alpha mask
            values[i] = Math.max(imgData[offset], imgData[offset + 1], imgData[offset + 2]) / 255;
        }
    }

    // Normalize alpha mask to peak 1.0 to ensure correct absolute opacity unblending
    let maxAlpha = 0;
    for (let i = 0; i < values.length; i++) {
        if (values[i] > maxAlpha) {
            maxAlpha = values[i];
        }
    }
    if (maxAlpha > 0) {
        for (let i = 0; i < values.length; i++) {
            values[i] /= maxAlpha;
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
 * Compiles the best opacity based on parsed sample frames
 */
function findBestOpacity(sampleFrames, watermark) {
    if (!sampleFrames.length) {
        return { opacity: OPACITY_CANDIDATES[0], margin: 0, scores: [] };
    }

    const results = OPACITY_CANDIDATES.map(op => ({ opacity: op, score: 0, count: 0 }));

    for (const frame of sampleFrames) {
        const scores = OPACITY_CANDIDATES.map(op => scoreWatermarkOpacity(frame.imageData, watermark, op));
        for (const s of scores) {
            const res = results.find(r => r.opacity === s.opacity);
            if (res && Number.isFinite(s.score)) {
                res.score += s.score;
                res.count++;
            }
        }
    }

    // Average the scores
    const averagedScores = results.map(r => ({
        opacity: r.opacity,
        score: r.count > 0 ? r.score / r.count : Infinity
    }));

    // Find candidate with lowest score
    const validScores = averagedScores.filter(s => Number.isFinite(s.score));
    validScores.sort((a, b) => a.score - b.score);

    if (!validScores.length) {
        return { opacity: OPACITY_CANDIDATES[0], margin: 0, scores: averagedScores };
    }

    const primary = validScores[0];

    // If multiple candidates have nearly identical scores, prefer the higher opacity
    // to ensure complete watermark removal
    let finalOpacity = primary.opacity;
    for (const s of validScores) {
        if (s.score - primary.score < 5 && s.opacity > finalOpacity) {
            finalOpacity = s.opacity;
        }
    }
    let margin = Infinity;

    if (validScores[1]) {
        margin = validScores[1].score - primary.score;
    }

    // Log for debugging
    console.log(`Opacity scores: ${validScores.slice(0, 5).map(s => `${s.opacity}=${s.score.toFixed(2)}`).join(', ')}`);
    console.log(`Selected opacity: ${finalOpacity} (margin: ${margin.toFixed(2)})`);

    return { opacity: finalOpacity, margin: margin, scores: averagedScores };
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

    if (count === 0) return -Infinity;

    const meanFrame = frameSum / count;
    const meanTemplate = templateSum / count;
    const stdDenominator = Math.sqrt((frameSqSum - count * meanFrame * meanFrame) * (templateSqSum - count * meanTemplate * meanTemplate));

    if (stdDenominator <= 0) return -Infinity;

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
            
            // For each watermark pixel, check if it's still significantly different
            // from background. Check PER-CHANNEL (not just luminance) to catch
            // color mismatches that luminance-based diff would miss.
            for (let y = 0; y < wHeight; y++) {
                for (let x = 0; x < wWidth; x++) {
                    const idx = y * wWidth + x;
                    const alpha = watermark.alphaMap.values[idx];
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
                        // Scale blend strength with alpha: high-alpha = stronger fill
                        // Higher minimum prevents any visible residual
                        const blendStrength = Math.min(0.97, 0.50 + alpha * 0.47);
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

    let runningOpacity = null;

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

    // Wait slightly to let MP4Box load metadata
    await new Promise(r => setTimeout(r, 200));

    if (!videoTrack) {
        throw new Error("No video track could be parsed from the file.");
    }

    onProgress({ stage: "demux", ratio: 1.0 });

    const width = videoTrack.video.width;
    const height = videoTrack.video.height;
    const totalSamples = videoSamples.length || 1;
    const timescale = videoSamples[0]?.timescale ?? videoTrack.timescale ?? 30000;
    
    const avgDuration = videoSamples.reduce((sum, s) => sum + s.duration, 0) / totalSamples || timescale / 30;
    const frameRate = Math.max(1, Math.round(timescale / avgDuration));

    const is1080p = (width === 1920 && height === 1080) || (width === 1080 && height === 1920);

    // Step 2: Load matching watermark asset - use bg_48.png scaled for all resolutions
    const isPortrait = height > width;
    let refWidth = isPortrait ? 720 : 1280;
    let baseWWidth = 48;
    let baseWHeight = 48;
    let watermarkUrl = "/watermarks/bg_48.png";
    let isColor = false;

    if (is1080p) {
        refWidth = isPortrait ? 1080 : 1920;
        baseWWidth = 72;
        baseWHeight = 72;
        watermarkUrl = "/watermarks/bg_48.png";
        isColor = false;
    } else {
        const area = width * height;
        const area720p = 1280 * 720;
        const area1080p = 1920 * 1080;
        // If resolution is closer to 1080p than 720p, treat it as scaled 1080p
        if (Math.abs(area - area1080p) < Math.abs(area - area720p)) {
            refWidth = isPortrait ? 1080 : 1920;
            baseWWidth = 72;
            baseWHeight = 72;
            watermarkUrl = "/watermarks/bg_48.png";
            isColor = false;
        }
    }

    const scale = width / refWidth;
    const targetWWidth = Math.round(baseWWidth * scale);
    const targetWHeight = Math.round(baseWHeight * scale);

    const alphaMap = await loadWatermarkMap(watermarkUrl, targetWWidth, targetWHeight, isColor);

    const baseOffsets = is1080p ? RESOLUTION_OFFSETS_1080P : RESOLUTION_OFFSETS_720P;
    const scaledOffsets = baseOffsets.map(offset => Math.round(offset * scale));
    const candidates = scaledOffsets.map(offset => ({
        x: clamp(width - offset, 0, width - alphaMap.width),
        y: clamp(height - offset, 0, height - alphaMap.height),
        alphaMap,
        score: 0,
        baseStrength: 1.0
    }));
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
    const targetBitrate = Math.max(8000000, Math.min(40000000, Math.round(width * height * frameRate * 0.30)));
    let encoderConfig = {
        codec: "avc1.640028", // H.264 High Profile
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
            codec: "avc1.42001f"
        };
        encoderSupported = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!encoderSupported.supported) {
            throw new Error("This browser does not support H.264 video encoding.");
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

    // Temporal frame sampling setup (sample up to 6 frames spread over the first 60 frames)
    const maxScanRange = Math.min(60, totalSamples);
    const sampleIndices = new Set();
    const numSamplesToGather = Math.min(6, maxScanRange);
    const step = Math.floor(maxScanRange / numSamplesToGather);
    for (let i = 0; i < numSamplesToGather; i++) {
        sampleIndices.add(i * step + Math.floor(step / 2));
    }

    let decodeError = null;
    let decodedFramesCount = 0;
    let framesProcessed = 0;
    let accumulationFramesCount = 0;
    const accumulatedFrames = [];

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

        const currentFrameIndex = decodedFramesCount;
        decodedFramesCount++;

        // If watermark coordinates are not selected yet, gather sample frames to run Pearson correlation
        if (!selectedWatermark) {
            // Buffer the frame data
            accumulatedFrames.push({
                index: currentFrameIndex,
                frameData
            });

            // If this frame index is one of our sample indices, accumulate correlation for detection
            if (sampleIndices.has(currentFrameIndex)) {
                for (const cand of candidates) {
                    cand.score += calculateWatermarkCorrelation(imgData, cand);
                }
                accumulationFramesCount++;
            }

            // Once we have gathered all required sample frames
            if (accumulationFramesCount >= sampleIndices.size) {
                // Find candidate with maximum correlation score
                const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
                const bestCand = sortedCandidates[0];
                const defaultCand = candidates[0];
                const threshold = 0.04 * Math.max(1, accumulationFramesCount);

                const avgBestScore = bestCand.score / Math.max(1, accumulationFramesCount);

                let lockedX = 0;
                let lockedY = 0;
                let finalScore = 0;

                if (avgBestScore < 0.15) {
                    console.log(`Watermark not found at standard coordinates (score ${avgBestScore.toFixed(3)}). Performing scan...`);
                    const match = findBestMatch(imgData, alphaMap, is1080p);
                    console.log(`Scan found match at x=${match.x}, y=${match.y} with score ${match.score.toFixed(3)}`);
                    lockedX = match.x;
                    lockedY = match.y;
                    finalScore = match.score;
                } else {
                    const seedCand = bestCand.score >= defaultCand.score + threshold ? bestCand : defaultCand;
                    // Refine peak locally around seedCand
                    let localBestScore = -Infinity;
                    let localBestX = seedCand.x;
                    let localBestY = seedCand.y;
                    
                    for (let dy = -6; dy <= 6; dy++) {
                        for (let dx = -6; dx <= 6; dx++) {
                            const testX = clamp(seedCand.x + dx, 0, width - alphaMap.width);
                            const testY = clamp(seedCand.y + dy, 0, height - alphaMap.height);
                            const corr = calculateWatermarkCorrelationAt(imgData, alphaMap, testX, testY);
                            if (corr > localBestScore) {
                                localBestScore = corr;
                                localBestX = testX;
                                localBestY = testY;
                            }
                        }
                    }
                    lockedX = localBestX;
                    lockedY = localBestY;
                    finalScore = localBestScore;
                    console.log(`Local refinement selected x=${lockedX}, y=${lockedY} with score ${finalScore.toFixed(3)} (base candidate was x=${seedCand.x}, y=${seedCand.y})`);
                }

                selectedWatermark = {
                    x: lockedX,
                    y: lockedY,
                    alphaMap,
                    score: finalScore,
                    baseStrength: 1.0
                };

                // For finding best opacity, we only want the frames that correspond to sampleIndices
                const opacitySampleFrames = accumulatedFrames
                    .filter(f => sampleIndices.has(f.index))
                    .map(f => f.frameData);

                // Evaluate best fitting opacity using simple brightness matching
                const opacityDetails = findBestOpacity(opacitySampleFrames, selectedWatermark);
                let estimatedOpacity = opacityDetails.opacity;
                
                // Also try the simple method and use it if it gives a more reasonable result
                const simpleOpacity = findOptimalOpacitySimple(opacitySampleFrames[0].imageData, selectedWatermark);
                
                // Use the simple method's result as it's more reliable
                // Apply a 1.15x boost to ensure complete removal without sparkle
                selectedWatermark.opacity = Math.min(simpleOpacity * 1.15, 0.85);
                
                console.log(`Opacity: complex=${estimatedOpacity}, simple=${simpleOpacity}, using simple`);
                
                // Apply opacity mode clamping
                if (opacityMode === "soft") {
                    selectedWatermark.opacity = clamp(selectedWatermark.opacity, 0.30, 0.60);
                } else if (opacityMode === "normal") {
                    selectedWatermark.opacity = clamp(selectedWatermark.opacity, 0.60, 1.0);
                }
                // Auto mode: use the natural estimated opacity without forcing
                
                runningOpacity = selectedWatermark.opacity;
                
                selectedWatermark.edgeCleanup = { strength: 1.0, radius: 5 };

                // Apply ceiling and overlay value for all watermarks to prevent division issues
                selectedWatermark.overlayValue = 255;
                selectedWatermark.ceiling = 1.0;
                selectedWatermark.baseStrength = 1.0;

                // Process all accumulated frames now that we have locked coords
                accumulatedFrames.sort((a, b) => a.index - b.index);
                for (const af of accumulatedFrames) {
                    encodeCleanedFrame(af.frameData);
                }
                accumulatedFrames.length = 0; // free memory
            }
            return;
        }

        // Standard workflow once coordinates are locked
        encodeCleanedFrame(frameData);
    };

    const encodeCleanedFrame = (frameData) => {
        // Opacity is frozen after initial estimation to prevent temporal
        // flicker ("sparkle"). Dynamic re-estimation causes underflow pixel
        // sets to shift frame-to-frame, producing visible instability.
        // The initial multi-frame estimate is already optimal for the video.
        if (selectedWatermark && runningOpacity !== null) {
            // Still allow periodic logging to monitor stability
            if (framesProcessed > 0 && framesProcessed % 30 === 0) {
                // Passive check only — no update
                if (framesProcessed % 30 === 0) {
                    console.log(`[DynamicOpacity] Frame ${framesProcessed}: frozen opacity=${selectedWatermark.opacity.toFixed(3)}`);
                }
            }
        }

        const cleanedImgData = cleanFrameWatermark(frameData.imageData, selectedWatermark || candidates[0]);
        
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

    // Step 6: Decode the samples in order
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
    await encoder.flush();

    if (decodeError) throw decodeError;
    if (encodingError) throw encodingError;

    decoder.close();
    encoder.close();

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
function findBestMatch(imageData, alphaMap, isColor) {
    const width = imageData.width;
    const height = imageData.height;
    const tWidth = alphaMap.width;
    const tHeight = alphaMap.height;

    const xMin = Math.max(0, width - 350);
    const xMax = width - tWidth;
    const yMin = Math.max(0, height - 350);
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
 * Automatically cleans standard corner watermarks on an image
 */
export async function cleanImageWatermarkAuto(canvas, onProgress, opacityMode) {
    const ctx = getCanvasContext(canvas);
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);

    onProgress?.(0.1);

    // Scale watermark template based on image dimensions
    const minDim = Math.min(width, height);
    const scale = minDim / 1024;
    const templateSize = Math.max(32, Math.round(48 * scale));

    const bg48Map = await loadWatermarkMap("/watermarks/bg_48.png", templateSize, templateSize, false);

    onProgress?.(0.3);

    const bgResult = findBestMatch(imgData, bg48Map, false);

    onProgress?.(0.6);

    let selected = null;
    if (bgResult.score > 0.3) {
        selected = {
            x: bgResult.x,
            y: bgResult.y,
            alphaMap: bg48Map,
            opacity: 1.0,
            overlayValue: 255,
            baseStrength: 1.0,
            ceiling: 1.0,
            edgeCleanup: { strength: 1.0, radius: 5 }
        };
    } else {
        // Fallback: use bottom-right corner
        selected = {
            x: Math.max(0, width - templateSize - 10),
            y: Math.max(0, height - templateSize - 10),
            alphaMap: bg48Map,
            opacity: 1.0,
            overlayValue: 255,
            baseStrength: 1.0,
            ceiling: 1.0,
            edgeCleanup: { strength: 1.0, radius: 5 }
        };
    }

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
    const iterations = 80;
    const workData = new Uint8ClampedArray(data);

    for (let iter = 0; iter < iterations; iter++) {
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

