/**
 * Calculates the Homography Matrix (3x3) mapping srcPoints to dstPoints.
 * Points are arrays of [x, y].
 * Returns a linear array of 9 elements representing the matrix.
 */
function getHomographyMatrix(srcPoints, dstPoints) {
    const a = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
        const x = srcPoints[i].x;
        const y = srcPoints[i].y;
        const u = dstPoints[i].x;
        const v = dstPoints[i].y;

        a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
        b.push(u);

        a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
        b.push(v);
    }

    // Solve Ax = b
    const h = solveGaussian(a, b);
    if (!h) return null; // Singular matrix handling
    h.push(1); // h33 is 1
    return h;
}

/**
 * Robust Gaussian Elimination Solver
 */
function solveGaussian(A, b) {
    const n = A.length;
    // Deep copy to avoid side effects
    const M = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
        // Pivot
        let maxEl = Math.abs(M[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(M[k][i]) > maxEl) {
                maxEl = Math.abs(M[k][i]);
                maxRow = k;
            }
        }

        // Pivot 0? Singular matrix
        if (Math.abs(maxEl) < 1e-10) return null;

        // Swap
        [M[i], M[maxRow]] = [M[maxRow], M[i]];

        // Normalize current row
        const div = M[i][i];
        for (let j = i; j < n + 1; j++) {
            M[i][j] /= div;
        }

        // Eliminate other rows
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = M[k][i];
                for (let j = i; j < n + 1; j++) {
                    M[k][j] -= factor * M[i][j];
                }
            }
        }
    }

    // Extract solution
    const x = [];
    for (let i = 0; i < n; i++) {
        x[i] = M[i][n];
    }
    return x;
}

/**
 * Warps an image using perspective transformation.
 * @param {HTMLImageElement} image - The source image
 * @param {Array} corners - Array of 4 points {x, y} (TopLeft, TopRight, BottomRight, BottomLeft)
 * @returns {Promise<Blob>} - The warped image as a Blob
 */
export async function warpImage(image, corners) {
    // 1. Calculate destination dimensions
    const tl = corners[0];
    const tr = corners[1];
    const br = corners[2];
    const bl = corners[3];

    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    let width = Math.max(widthTop, widthBottom);

    const heightLeft = Math.hypot(tl.x - bl.x, tl.y - bl.y);
    const heightRight = Math.hypot(tr.x - br.x, tr.y - br.y);
    let height = Math.max(heightLeft, heightRight);

    // Limit max resolution to avoid heavy processing/memory issues
    const MAX_DIM = 1200;
    if (width > MAX_DIM || height > MAX_DIM) {
        const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    // Ensure minimum dimensions
    width = Math.max(10, width);
    height = Math.max(10, height);

    console.log(`Warping to ${width}x${height}`);

    // 2. Define destination points
    const dstPoints = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height }
    ];

    // 3. Compute Homography: DST (Rectangle) -> SRC (Distorted)
    // We map each pixel (u,v) in the new rectangular image to (x,y) in the original image
    const H = getHomographyMatrix(dstPoints, corners);

    if (!H || H.some(v => isNaN(v))) {
        throw new Error("Failed to calculate perspective matrix (Geometric Error)");
    }

    // 4. Create Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // 5. Source Data
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = image.naturalWidth || image.width;
    srcCanvas.height = image.naturalHeight || image.height;
    const srcCtx = srcCanvas.getContext('2d');
    let srcData;
    try {
        srcCtx.drawImage(image, 0, 0);
        srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
    } catch (e) {
        console.error("Canvas Security Error:", e);
        throw new Error("Cannot access image data. Possible CORS issue. " + e.message);
    }

    const srcWidth = srcCanvas.width;
    const srcHeight = srcCanvas.height;

    let validPixels = 0;

    for (let v = 0; v < height; v++) {
        for (let u = 0; u < width; u++) {
            // Apply Homography: src = H * dst
            const den = H[6] * u + H[7] * v + H[8];
            // Avoid division by zero
            if (Math.abs(den) < 1e-10) continue;

            const srcX = (H[0] * u + H[1] * v + H[2]) / den;
            const srcY = (H[3] * u + H[4] * v + H[5]) / den;

            // Nearest Neighbor Interpolation
            const sx = Math.round(srcX);
            const sy = Math.round(srcY);

            if (sx >= 0 && sx < srcWidth && sy >= 0 && sy < srcHeight) {
                const srcIdx = (sy * srcWidth + sx) * 4;
                const dstIdx = (v * width + u) * 4;

                data[dstIdx] = srcData[srcIdx];
                data[dstIdx + 1] = srcData[srcIdx + 1];
                data[dstIdx + 2] = srcData[srcIdx + 2];
                data[dstIdx + 3] = 255; // Alpha
                validPixels++;
            }
        }
    }

    if (validPixels < 100) {
        console.error("Warp produced empty image. H:", H, "Corners:", corners);
        throw new Error("Perspective correction failed: Output image is empty.");
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob failed"));
        }, 'image/jpeg', 0.9);
    });
}
