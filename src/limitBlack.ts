/**
 * Some thermal printers cannot fire more than about half the dots of a row at once: black above that fades and a
 * full row prints nothing (measured on a 384 dot printer: 192 contiguous dots print solid, 240 are streaky,
 * 288 very faint, 336 almost invisible, 384 blank; ESC 7 and DC2 # make no difference).
 *
 * This keeps every row at or below `maxFraction` of the width black, so large black areas still print.
 * Rows that are already under the limit (nearly all text) are left untouched. A row over it loses only as many dots
 * as it must, in this order, spread evenly along the row:
 *   1. deep interior dots (everything within 2 dots is black) inside the cleared chunks of a coarse checker of
 *      CHUNK_W x CHUNK_H dot chunks. That prints dark (8 and 24 dot chunks both worked on the printer) and keeps
 *      outlines and a 2 dot margin around white text intact;
 *   2. any other black dot in the cleared chunks, which turns a full width rule into dashes.
 */
export const CHUNK_W = 8;
export const CHUNK_H = 4;
const INTERIOR_MARGIN = 2;

/**
 * @param pixels greyscale, row by row, dots with a value at or below `threshold` are black
 * @returns a new array, the input is not modified
 */
export const limitBlackPerRow = (
    pixels: Uint8Array,
    width: number,
    height: number,
    maxFraction = 0.5,
    threshold = 200,
): Uint8Array => {
    const out = pixels.slice();
    const max = Math.floor(width * maxFraction);
    const black = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height && pixels[y * width + x] <= threshold;

    for (let y = 0; y < height; y++) {
        let count = 0;
        for (let x = 0; x < width; x++) {
            if (black(x, y)) {
                count++;
            }
        }
        if (count <= max) {
            continue;
        }
        const chunkRow = Math.floor(y / CHUNK_H);
        const inClearedChunk = (x: number) => (Math.floor(x / CHUNK_W) + chunkRow) % 2 === 1;
        const deepInterior = (x: number) => {
            for (let dy = -INTERIOR_MARGIN; dy <= INTERIOR_MARGIN; dy++) {
                for (let dx = -INTERIOR_MARGIN; dx <= INTERIOR_MARGIN; dx++) {
                    if (!black(x + dx, y + dy)) {
                        return false;
                    }
                }
            }
            return true;
        };
        let excess = count - max;
        const removeEvenly = (candidates: number[]) => {
            const n = Math.min(excess, candidates.length);
            for (let i = 0; i < n; i++) {
                out[y * width + candidates[Math.floor((i + 0.5) * candidates.length / n)]] = 255;
            }
            excess -= n;
        };
        const columns = Array.from({ length: width }, (_, x) => x);
        removeEvenly(columns.filter((x) => black(x, y) && inClearedChunk(x) && deepInterior(x)));
        if (excess > 0) {
            removeEvenly(columns.filter((x) => out[y * width + x] <= threshold && inClearedChunk(x)));
        }
        if (excess > 0) {
            removeEvenly(columns.filter((x) => out[y * width + x] <= threshold));
        }
    }
    return out;
};
