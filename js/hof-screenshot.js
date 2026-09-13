/* Hall of Fame screenshot recognition (V1).
 * Browser-only, deterministic Canvas processing. V1 handles only the visible
 * six-column main inventory and the visible combo panel; scrolling is out of scope.
 */
(function () {
    "use strict";

    const COLS = 6;
    const COLORS = {
        empty: [98, 49, 68],
        item: [77, 73, 106],
        framedItem: [50, 49, 62],
        comboPanel: [61, 45, 57],
    };
    const imageCache = new Map();
    const templateCache = new Map();

    function distance(a, b) {
        return Math.sqrt(
            (a[0] - b[0]) ** 2 +
            (a[1] - b[1]) ** 2 +
            (a[2] - b[2]) ** 2,
        );
    }

    function median(values) {
        const sorted = values.slice().sort((a, b) => a - b);
        if (!sorted.length) return 0;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function imageToCanvas(image) {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        canvas.getContext("2d").drawImage(image, 0, 0);
        return canvas;
    }

    function cropCanvas(source, x, y, width, height) {
        const left = Math.max(0, Math.round(x));
        const top = Math.max(0, Math.round(y));
        const right = Math.min(source.width, Math.round(x + width));
        const bottom = Math.min(source.height, Math.round(y + height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, right - left);
        canvas.height = Math.max(1, bottom - top);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(source, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function smoothProjection(values, radius = 3) {
        return values.map((_, index) => {
            let sum = 0;
            let count = 0;
            for (let i = Math.max(0, index - radius); i <= Math.min(values.length - 1, index + radius); i++) {
                sum += values[i];
                count++;
            }
            return sum / count;
        });
    }

    function projectionBands(values, ratio, minWidth, maxWidth = Infinity) {
        const smoothed = smoothProjection(values);
        const max = Math.max(...smoothed);
        if (!Number.isFinite(max) || max <= 0) return [];
        const threshold = max * ratio;
        const bands = [];
        let start = -1;

        for (let i = 0; i <= smoothed.length; i++) {
            if (i < smoothed.length && smoothed[i] >= threshold) {
                if (start < 0) start = i;
            } else if (start >= 0) {
                const width = i - start;
                if (width >= minWidth && width <= maxWidth) {
                    bands.push({ start, end: i - 1, center: (start + i - 1) / 2, width });
                }
                start = -1;
            }
        }
        return bands;
    }

    function regularSequence(bands, requiredLength, maxLength = 8) {
        let best = null;
        const minLength = requiredLength || 2;
        const upper = requiredLength || Math.min(maxLength, bands.length);

        for (let start = 0; start < bands.length; start++) {
            for (let length = minLength; length <= upper && start + length <= bands.length; length++) {
                const sequence = bands.slice(start, start + length);
                const gaps = sequence.slice(1).map((band, index) => band.center - sequence[index].center);
                const pitch = median(gaps);
                if (pitch < 70 || pitch > 180) continue;
                const deviation = gaps.reduce((sum, gap) => sum + Math.abs(gap - pitch), 0) / gaps.length;
                if (deviation > Math.max(12, pitch * 0.13)) continue;
                const score = length * 1000 + sequence.reduce((sum, band) => sum + band.width, 0) - deviation * 20;
                if (!best || score > best.score) best = { sequence, pitch, score };
            }
        }
        return best;
    }

    function fixedRegularSequence(bands, length) {
        let best = null;
        for (let a = 0; a < bands.length; a++) {
            for (let b = a + 1; b < bands.length; b++) {
                for (let gridGap = 1; gridGap < length; gridGap++) {
                    const pitch = (bands[b].center - bands[a].center) / gridGap;
                    if (pitch < 70 || pitch > 180) continue;
                    for (let gridIndex = 0; gridIndex < length; gridIndex++) {
                        const origin = bands[a].center - gridIndex * pitch;
                        const sequence = [];
                        let matches = 0;
                        let error = 0;
                        for (let i = 0; i < length; i++) {
                            const expected = origin + i * pitch;
                            const nearest = bands.reduce((current, band) =>
                                Math.abs(band.center - expected) < Math.abs(current.center - expected) ? band : current,
                            );
                            const delta = Math.abs(nearest.center - expected);
                            if (delta <= Math.max(14, pitch * 0.14)) {
                                matches++;
                                error += delta;
                            }
                            sequence.push({
                                start: expected - pitch * 0.42,
                                end: expected + pitch * 0.42,
                                center: expected,
                                width: pitch * 0.84,
                            });
                        }
                        if (matches < Math.min(4, length)) continue;
                        const score = matches * 1000 - error;
                        if (!best || score > best.score) best = { sequence, pitch, score };
                    }
                }
            }
        }
        return best;
    }

    function slotBackgroundPixel(r, g, b) {
        return distance([r, g, b], COLORS.empty) < 20 || distance([r, g, b], COLORS.item) < 28;
    }

    function columnBackgroundPixel(r, g, b) {
        return slotBackgroundPixel(r, g, b) || distance([r, g, b], COLORS.framedItem) < 22;
    }

    function detectMainInventoryFromCanvas(canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // The reserve bag is always below the main inventory. Keeping grid
        // discovery above the bottom fifth prevents its separate six-slot row
        // from competing with the main six-column lattice.
        const searchBottom = Math.max(1, Math.floor(height * 0.8));
        const xProjection = new Array(width).fill(0);

        for (let y = 0; y < searchBottom; y += 2) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                if (slotBackgroundPixel(data[index], data[index + 1], data[index + 2])) xProjection[x]++;
            }
        }

        const xCandidates = projectionBands(xProjection, 0.34, 38, 125);
        let columns = fixedRegularSequence(xCandidates, COLS);
        if (!columns) {
            const fallbackProjection = new Array(width).fill(0);
            for (let y = 0; y < searchBottom; y += 2) {
                for (let x = 0; x < width; x++) {
                    const index = (y * width + x) * 4;
                    if (columnBackgroundPixel(data[index], data[index + 1], data[index + 2])) fallbackProjection[x]++;
                }
            }
            columns = fixedRegularSequence(projectionBands(fallbackProjection, 0.34, 38, 125), COLS);
        }
        if (!columns) return null;

        const xStart = Math.max(0, Math.floor(columns.sequence[0].start - columns.pitch * 0.15));
        const xEnd = Math.min(width, Math.ceil(columns.sequence[COLS - 1].end + columns.pitch * 0.15));
        const yProjection = new Array(height).fill(0);
        for (let y = 0; y < height; y++) {
            for (let x = xStart; x < xEnd; x += 2) {
                const index = (y * width + x) * 4;
                if (slotBackgroundPixel(data[index], data[index + 1], data[index + 2])) yProjection[y]++;
            }
        }

        const yCandidates = projectionBands(yProjection, 0.32, 38, 125);
        let rows = regularSequence(yCandidates, null, 6);
        if (!rows) {
            const fallbackYProjection = new Array(height).fill(0);
            for (let y = 0; y < searchBottom; y++) {
                for (let x = xStart; x < xEnd; x += 2) {
                    const index = (y * width + x) * 4;
                    if (columnBackgroundPixel(data[index], data[index + 1], data[index + 2])) fallbackYProjection[y]++;
                }
            }
            rows = regularSequence(projectionBands(fallbackYProjection, 0.32, 38, 125), null, 6);
        }
        if (!rows) return null;

        return {
            canvas,
            cols: COLS,
            rows: rows.sequence.length,
            xCenters: columns.sequence.map((band) => band.center),
            yCenters: rows.sequence.map((band) => band.center),
            cellWidth: columns.pitch,
            cellHeight: rows.pitch,
        };
    }

    // ---- Level-badge number recognition (+N / -N shown on empty/occupied slots) ----
    // Templates are rendered at runtime from the site's own Galmuri11-Bold font
    // (already loaded via CSS), so no extra asset files are needed. Matching uses
    // a hole-count pre-filter (0/4/6/8/9 all enclose one+ region, 8 encloses two,
    // the rest enclose none) before falling back to aspect-preserving pixel overlap,
    // since raw overlap alone confuses same-silhouette digits like 0 vs 3 at this size.
    const DIGIT_CHARS = "0123456789+-/";
    let digitTemplates = null;

    function buildDigitTemplates() {
        if (digitTemplates) return digitTemplates;
        digitTemplates = {};
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.font = "700 14px 'Galmuri11'";
        ctx.textBaseline = "top";
        for (const ch of DIGIT_CHARS) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#000000";
            ctx.fillText(ch, 2, 2);
            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
            digitTemplates[ch] = binarizeAlpha(data, canvas.width, canvas.height);
        }
        return digitTemplates;
    }

    // Reduces an RGBA buffer to a 0/1 ink grid using alpha (text drawn as solid fill).
    function binarizeAlpha(data, width, height) {
        const grid = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) grid[i] = data[i * 4 + 3] > 128 ? 1 : 0;
        return { grid, width, height };
    }

    // Reduces a screenshot patch to a 0/1 ink grid using a caller-supplied color test.
    function binarizeColor(data, width, height, isInk) {
        const grid = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const o = i * 4;
            grid[i] = isInk(data[o], data[o + 1], data[o + 2]) ? 1 : 0;
        }
        return { grid, width, height };
    }

    function inkBounds(bitmap) {
        let minX = bitmap.width, maxX = -1, minY = bitmap.height, maxY = -1;
        for (let y = 0; y < bitmap.height; y++) {
            for (let x = 0; x < bitmap.width; x++) {
                if (bitmap.grid[y * bitmap.width + x]) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0) return null;
        return { minX, maxX, minY, maxY };
    }

    // Splits a wide ink bitmap into per-character column bands, merging thin gaps
    // that fall inside a single glyph (e.g. the two strokes of "+").
    function splitIntoCharacters(bitmap, mergeGap = 2) {
        const colHasInk = new Array(bitmap.width).fill(false);
        for (let x = 0; x < bitmap.width; x++) {
            for (let y = 0; y < bitmap.height; y++) {
                if (bitmap.grid[y * bitmap.width + x]) { colHasInk[x] = true; break; }
            }
        }
        const raw = [];
        let start = -1;
        for (let x = 0; x <= bitmap.width; x++) {
            if (x < bitmap.width && colHasInk[x]) {
                if (start < 0) start = x;
            } else if (start >= 0) {
                raw.push([start, x]);
                start = -1;
            }
        }
        const merged = [];
        for (const region of raw) {
            const previous = merged[merged.length - 1];
            if (previous && region[0] - previous[1] <= mergeGap) previous[1] = region[1];
            else merged.push(region);
        }
        return merged;
    }

    // Resizes a cropped glyph onto a fixed square canvas, preserving aspect ratio,
    // so thin glyphs (like "-") can't be stretched into misleadingly solid blobs.
    function toSquareBitmap(bitmap, box, size = 32) {
        const w = box.maxX - box.minX + 1;
        const h = box.maxY - box.minY + 1;
        const scale = (size - 4) / Math.max(w, h);
        const nw = Math.max(1, Math.round(w * scale));
        const nh = Math.max(1, Math.round(h * scale));
        const grid = new Uint8Array(size * size);
        const offX = Math.floor((size - nw) / 2);
        const offY = Math.floor((size - nh) / 2);
        for (let y = 0; y < nh; y++) {
            const srcY = box.minY + Math.floor((y / nh) * h);
            for (let x = 0; x < nw; x++) {
                const srcX = box.minX + Math.floor((x / nw) * w);
                if (bitmap.grid[srcY * bitmap.width + srcX]) {
                    grid[(y + offY) * size + (x + offX)] = 1;
                }
            }
        }
        return { grid, width: size, height: size };
    }

    function countHoles(square) {
        const { width, height, grid } = square;
        const visited = new Uint8Array(width * height);
        const isBackground = (x, y) => !grid[y * width + x];
        const queue = [];
        for (let x = 0; x < width; x++) {
            [0, height - 1].forEach((y) => {
                if (isBackground(x, y) && !visited[y * width + x]) { visited[y * width + x] = 1; queue.push([x, y]); }
            });
        }
        for (let y = 0; y < height; y++) {
            [0, width - 1].forEach((x) => {
                if (isBackground(x, y) && !visited[y * width + x]) { visited[y * width + x] = 1; queue.push([x, y]); }
            });
        }
        while (queue.length) {
            const [x, y] = queue.pop();
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const idx = ny * width + nx;
                if (!visited[idx] && isBackground(nx, ny)) { visited[idx] = 1; queue.push([nx, ny]); }
            }
        }
        // Any un-reached background pixel is enclosed by ink -> flood-fill it as one hole.
        let holes = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (!grid[idx] && !visited[idx]) {
                    holes++;
                    const stack = [[x, y]];
                    visited[idx] = 1;
                    while (stack.length) {
                        const [cx, cy] = stack.pop();
                        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                            const nx = cx + dx, ny = cy + dy;
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            const nIdx = ny * width + nx;
                            if (!grid[nIdx] && !visited[nIdx]) { visited[nIdx] = 1; stack.push([nx, ny]); }
                        }
                    }
                }
            }
        }
        return holes;
    }

    function overlapScore(a, b) {
        let match = 0;
        for (let i = 0; i < a.grid.length; i++) if ((a.grid[i] > 0) === (b.grid[i] > 0)) match++;
        return match / a.grid.length;
    }

    // Recognizes a short digit/sign string (e.g. "+2", "-1", "3/1") from a badge
    // region. isInk selects which pixels count as text (badge color varies: white
    // level-modifier text, red minus-badges, yellow artifact-level readouts).
    function recognizeNumber(patch, region, isInk) {
        const templates = buildDigitTemplates();
        const ctx = patch.getContext("2d", { willReadFrequently: true });
        const { data, width, height } = ctx.getImageData(region.x, region.y, region.width, region.height);
        const bitmap = binarizeColor(data, region.width, region.height, isInk);
        const charRegions = splitIntoCharacters(bitmap);
        let result = "";
        let minScore = 1;
        for (const [x0, x1] of charRegions) {
            const columnBitmap = { grid: new Uint8Array(region.width * region.height), width: region.width, height: region.height };
            for (let y = 0; y < region.height; y++) {
                for (let x = x0; x < x1; x++) columnBitmap.grid[y * region.width + x] = bitmap.grid[y * region.width + x];
            }
            const box = inkBounds(columnBitmap);
            if (!box) continue;
            const square = toSquareBitmap(columnBitmap, box);
            const holes = countHoles(square);
            const sameHoleChars = Object.keys(templates).filter((ch) => countHoles(templates[ch]) === holes);
            const pool = sameHoleChars.length ? sameHoleChars : Object.keys(templates);
            let bestChar = null;
            let bestScore = -1;
            for (const ch of pool) {
                const score = overlapScore(square, templates[ch]);
                if (score > bestScore) { bestScore = score; bestChar = ch; }
            }
            if (bestChar) {
                result += bestChar;
                minScore = Math.min(minScore, bestScore);
            }
        }
        return result ? { text: result, confidence: minScore } : null;
    }

    function classifySlot(layout, row, col) {
        const centerX = layout.xCenters[col];
        const centerY = layout.yCenters[row];
        const x = centerX - layout.cellWidth / 2;
        const y = centerY - layout.cellHeight / 2;
        const patch = cropCanvas(
            layout.canvas,
            x + layout.cellWidth * 0.1,
            y + layout.cellHeight * 0.1,
            layout.cellWidth * 0.8,
            layout.cellHeight * 0.8,
        );
        const ctx = patch.getContext("2d", { willReadFrequently: true });
        const pixels = ctx.getImageData(0, 0, patch.width, patch.height).data;
        let itemPixels = 0;
        let framedItemPixels = 0;
        let emptyPixels = 0;
        let redPixels = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
            if (distance(rgb, COLORS.item) < 32) itemPixels++;
            if (distance(rgb, COLORS.framedItem) < 22) framedItemPixels++;
            if (distance(rgb, COLORS.empty) < 28) emptyPixels++;
            if (pixels[i] > 155 && pixels[i] > pixels[i + 1] * 1.45 && pixels[i] > pixels[i + 2] * 1.25) redPixels++;
        }

        const textPixels = ctx.getImageData(
            0,
            0,
            Math.max(1, Math.round(patch.width * 0.42)),
            Math.max(1, Math.round(patch.height * 0.33)),
        ).data;
        let lightPixels = 0;
        for (let i = 0; i < textPixels.length; i += 4) {
            if (textPixels[i] > 165 && textPixels[i + 1] > 135 && textPixels[i + 2] > 115) lightPixels++;
        }

        const total = pixels.length / 4;
        const badgeRegion = {
            x: 0,
            y: 0,
            width: Math.max(1, Math.round(patch.width * 0.55)),
            height: Math.max(1, Math.round(patch.height * 0.3)),
        };
        if (framedItemPixels / total > 0.88 && itemPixels / total < 0.02 && redPixels < 3 && lightPixels < 3) {
            return { state: "absent", patch };
        }
        if (itemPixels / total > 0.12 || framedItemPixels / total > 0.18) {
            // Occupied slots can additionally show the artifact's own level readout
            // (e.g. "3/1") in the same corner; best-effort only, not required for matching.
            const level = recognizeNumber(
                patch,
                badgeRegion,
                (r, g, b) => r > 190 && g > 160 && b < 90, // 노란 텍스트만, 프레임/아이콘 색과 안 겹치게 엄격하게
            );
            return { state: "occupied", patch, level };
        }
        if (redPixels > 3) {
            const badge = recognizeNumber(patch, badgeRegion, (r, g, b) => r > 150 && r > g * 1.3 && r > b * 1.05);
            return { state: "minus", patch, badge };
        }
        if (lightPixels > 3) {
            const badge = recognizeNumber(patch, badgeRegion, (r, g, b) => r > 165 && g > 135 && b > 115);
            return { state: "plus", patch, badge };
        }
        if (emptyPixels / total > 0.22) return { state: "empty", patch };
        return { state: "unknown", patch };
    }

    function loadImage(item) {
        const key = `${item.kind}:${item.file}`;
        if (imageCache.has(key)) return imageCache.get(key);
        const promise = new Promise((resolve) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = item.icon;
        });
        imageCache.set(key, promise);
        return promise;
    }

    function scaledTemplate(item, image, scale) {
        const key = `${item.kind}:${item.file}:${scale}`;
        if (templateCache.has(key)) return templateCache.get(key);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = {
            width: canvas.width,
            height: canvas.height,
            data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        };
        templateCache.set(key, result);
        return result;
    }

    function templateScore(source, sourceWidth, sourceHeight, template, offsetX, offsetY, grayscale) {
        let error = 0;
        let compared = 0;
        for (let ty = 0; ty < template.height; ty++) {
            const sy = offsetY + ty;
            if (sy < 0 || sy >= sourceHeight) continue;
            for (let tx = 0; tx < template.width; tx++) {
                const sx = offsetX + tx;
                if (sx < 0 || sx >= sourceWidth) continue;
                const ti = (ty * template.width + tx) * 4;
                if (template.data[ti + 3] < 80) continue;
                const si = (sy * sourceWidth + sx) * 4;
                if (grayscale) {
                    const sourceLuma = source[si] * 0.299 + source[si + 1] * 0.587 + source[si + 2] * 0.114;
                    const templateLuma = template.data[ti] * 0.299 + template.data[ti + 1] * 0.587 + template.data[ti + 2] * 0.114;
                    error += Math.abs(sourceLuma - templateLuma) / 255;
                } else {
                    error += distance(
                        [source[si], source[si + 1], source[si + 2]],
                        [template.data[ti], template.data[ti + 1], template.data[ti + 2]],
                    ) / 441.67;
                }
                compared++;
            }
        }
        if (compared < 12) return 0;
        return 1 - error / compared;
    }

    // Disabled inventory icons are rendered as a much darker grayscale version
    // of the source sprite. Pearson correlation removes that brightness/contrast
    // shift while retaining the sprite's internal shape and shading pattern.
    function normalizedLumaScore(source, sourceWidth, sourceHeight, template, offsetX, offsetY) {
        let count = 0;
        let sourceSum = 0;
        let templateSum = 0;
        let sourceSquareSum = 0;
        let templateSquareSum = 0;
        let productSum = 0;

        for (let ty = 0; ty < template.height; ty++) {
            const sy = offsetY + ty;
            if (sy < 0 || sy >= sourceHeight) continue;
            for (let tx = 0; tx < template.width; tx++) {
                const sx = offsetX + tx;
                if (sx < 0 || sx >= sourceWidth) continue;
                const ti = (ty * template.width + tx) * 4;
                if (template.data[ti + 3] < 80) continue;
                const si = (sy * sourceWidth + sx) * 4;
                const sourceLuma = source[si] * 0.299 + source[si + 1] * 0.587 + source[si + 2] * 0.114;
                const templateLuma = template.data[ti] * 0.299 + template.data[ti + 1] * 0.587 + template.data[ti + 2] * 0.114;
                count++;
                sourceSum += sourceLuma;
                templateSum += templateLuma;
                sourceSquareSum += sourceLuma * sourceLuma;
                templateSquareSum += templateLuma * templateLuma;
                productSum += sourceLuma * templateLuma;
            }
        }

        if (count < 48) return 0;
        const covariance = productSum - (sourceSum * templateSum) / count;
        const sourceVariance = sourceSquareSum - (sourceSum * sourceSum) / count;
        const templateVariance = templateSquareSum - (templateSum * templateSum) / count;
        if (sourceVariance < 1 || templateVariance < 1) return 0;
        const correlation = covariance / Math.sqrt(sourceVariance * templateVariance);
        return Math.max(0, Math.min(1, (correlation + 1) / 2));
    }

    async function matchAsset(
        patch,
        candidates,
        minimumScore = 0.57,
        maxTemplateRatio = 0.85,
        scales = [1, 2, 3, 4],
    ) {
        const ctx = patch.getContext("2d", { willReadFrequently: true });
        const source = ctx.getImageData(0, 0, patch.width, patch.height).data;
        const loaded = await Promise.all(
            candidates.map(async (item) => ({ item, image: await loadImage(item) })),
        );
        let best = null;

        for (const { item, image } of loaded) {
            if (!image) continue;
            for (const scale of scales) {
                const template = scaledTemplate(item, image, scale);
                if (template.width > patch.width * maxTemplateRatio || template.height > patch.height * maxTemplateRatio) continue;
                const baseX = Math.round((patch.width - template.width) / 2);
                const baseY = Math.round((patch.height - template.height) / 2);
                for (const dx of [-6, 0, 6]) {
                    for (const dy of [-6, 0, 6]) {
                        const rgb = templateScore(source, patch.width, patch.height, template, baseX + dx, baseY + dy, false);
                        const gray = templateScore(source, patch.width, patch.height, template, baseX + dx, baseY + dy, true);
                        const normalized = normalizedLumaScore(source, patch.width, patch.height, template, baseX + dx, baseY + dy);
                        const score = Math.max(rgb, gray * 0.96, normalized * 0.97);
                        if (!best || score > best.score) best = { item, score };
                    }
                }
            }
        }
        return best && best.score >= minimumScore ? best : null;
    }

    function detectComboPanelFromCanvas(canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const xProjection = new Array(width).fill(0);
        const yProjection = new Array(height).fill(0);
        for (let y = 0; y < height; y += 2) {
            for (let x = 0; x < width; x += 2) {
                const index = (y * width + x) * 4;
                if (distance([data[index], data[index + 1], data[index + 2]], COLORS.comboPanel) < 11) {
                    xProjection[x]++;
                    yProjection[y]++;
                }
            }
        }
        const xBands = projectionBands(xProjection, 0.30, 180);
        const yBands = projectionBands(yProjection, 0.30, 160);
        if (!xBands.length || !yBands.length) return null;
        const xBand = xBands.sort((a, b) => b.width - a.width)[0];
        const yBand = yBands.sort((a, b) => b.width - a.width)[0];
        return {
            canvas,
            x: Math.max(0, xBand.start - 20),
            y: Math.max(0, yBand.start - 80),
            width: Math.min(width - xBand.start + 20, xBand.width + 40),
            height: Math.min(height - Math.max(0, yBand.start - 80), yBand.width + 100),
        };
    }

    function mergeNearbyBands(bands, maxGap = 12) {
        const merged = [];
        bands.forEach((band) => {
            const previous = merged[merged.length - 1];
            if (previous && band.start - previous.end <= maxGap) {
                previous.end = band.end;
                previous.width = previous.end - previous.start + 1;
                previous.center = (previous.start + previous.end) / 2;
            } else {
                merged.push({ ...band });
            }
        });
        return merged;
    }

    function detectComboIconRects(panel) {
        const ctx = panel.canvas.getContext("2d", { willReadFrequently: true });
        const { data, width } = ctx.getImageData(0, 0, panel.canvas.width, panel.canvas.height);
        const top = Math.max(0, Math.floor(panel.y));
        const bottom = Math.min(panel.canvas.height, Math.ceil(panel.y + panel.height));
        const iconSize = Math.min(62, panel.width * 0.145);
        const scanLeft = Math.max(0, Math.round(panel.x + panel.width * 0.065));
        const scanRight = Math.min(panel.canvas.width, Math.round(scanLeft + iconSize));
        const yProjection = new Array(panel.canvas.height).fill(0);
        for (let y = top; y < bottom; y++) {
            for (let x = scanLeft; x < scanRight; x++) {
                const index = (y * width + x) * 4;
                if (data[index] < 25 && data[index + 1] < 25 && data[index + 2] < 25) yProjection[y]++;
            }
        }

        const rowBands = mergeNearbyBands(projectionBands(yProjection, 0.20, 8, 80), 3);
        return rowBands
            .filter((band) => band.width >= 24 && band.width <= 75)
            .map((band) => {
                return {
                    x: scanLeft,
                    y: band.center - iconSize / 2,
                    width: iconSize,
                    height: iconSize,
                };
            });
    }

    async function recognizeCombos(panel, pickerData) {
        if (!panel || !(pickerData.combo || []).length) return [];
        const results = [];
        const iconRects = detectComboIconRects(panel);
        for (const rect of iconRects) {
            const patch = cropCanvas(
                panel.canvas,
                rect.x,
                rect.y,
                rect.width,
                rect.height,
            );
            // Combo icons are 19px source sprites rendered at exactly 3x in the
            // game UI. Compare that sprite against the complete 62px icon box;
            // retaining the frame here also preserves the correct centering.
            const match = await matchAsset(patch, pickerData.combo, 0.55, 0.98, [3]);
            if (match && !results.some((item) => item.file === match.item.file)) {
                results.push({ ...match.item, score: match.score });
            }
        }
        return results;
    }

    async function recognize({ image, pickerData, onProgress }) {
        const canvas = imageToCanvas(image);
        const inventoryLayout = detectMainInventoryFromCanvas(canvas);
        const inventory = [];

        if (inventoryLayout) {
            for (let row = 0; row < inventoryLayout.rows; row++) {
                for (let col = 0; col < inventoryLayout.cols; col++) {
                    const index = row * inventoryLayout.cols + col;
                    const classified = classifySlot(inventoryLayout, row, col);
                    const result = {
                        index,
                        row,
                        col,
                        state: classified.state,
                        item: null,
                        score: 0,
                        badge: classified.badge || classified.level || null,
                    };
                    if (classified.state === "occupied") {
                        if (onProgress) onProgress(`인벤토리 아이템을 비교하는 중... (${index + 1}/${inventoryLayout.rows * COLS})`);
                        const match = await matchAsset(
                            classified.patch,
                            [...(pickerData.artifact || []), ...(pickerData.tablet || [])],
                        );
                        if (match) {
                            result.item = match.item;
                            result.score = match.score;
                        }
                    }
                    inventory.push(result);
                }
            }
        }

        if (onProgress) onProgress("콤보 아이콘을 비교하는 중...");
        const comboPanel = detectComboPanelFromCanvas(canvas);
        const combos = await recognizeCombos(comboPanel, pickerData);
        return {
            inventoryDetected: Boolean(inventoryLayout),
            comboDetected: Boolean(comboPanel),
            rows: inventoryLayout ? inventoryLayout.rows : 0,
            inventory,
            combos,
        };
    }

    window.HofScreenshotRecognizer = { recognize };
})();
