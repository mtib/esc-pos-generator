/**
 * Some thermal printers cannot fire more than about half the dots of a row at once: black above that fades and a
 * full row prints nothing. Measured on the 384 dot 0456:0808 printer: contiguous bars of 192, 200 and 208 dots
 * print solid, 216 gets a few white specks, 224 to 240 are mottled; scattered patterns degrade sooner (62% coverage,
 * about 240 dots, is streaky), 288 dots are very faint, 336 almost invisible, 384 blank. ESC 7 and DC2 # make no
 * difference, and pausing between rows does not help. The default of 54% (207 dots) is the last solid width.
 *
 * This keeps every row at or below `maxFraction` of the width black, so large black areas still print.
 * Rows that are already under the limit (nearly all text) are left untouched. A row over it loses exactly as many
 * dots as it must, chosen by an ordered dither on CELL x CELL dot cells (a Bayer matrix ranks the cells, the lowest
 * ranks go first), so a heavy area becomes a halftone and a slightly heavy row loses only a few scattered cells:
 *   1. deep interior dots (everything within 2 dots is black) go first, which keeps outlines and a 2 dot margin
 *      around white text intact;
 *   2. if that is not enough, any other black dot, which turns a full width rule into a fine dotted line.
 */
export const DEFAULT_MAX_FRACTION = 0.54;
/** Edge length in dots of one dither cell; 2 dot cells printed as dark as larger ones in the printer tests. */
export const CELL = 2;
const INTERIOR_MARGIN = 2;

/** 8 x 8 Bayer matrix value (0 to 63) by the standard recursion. */
const bayer8 = (x: number, y: number): number => {
    const level = (bx: number, by: number) => 2 * (bx ^ by) + by;
    return level(x & 1, y & 1) * 16 + level((x >> 1) & 1, (y >> 1) & 1) * 4 + level((x >> 2) & 1, (y >> 2) & 1);
};

/**
 * @param pixels greyscale, row by row, dots with a value at or below `threshold` are black
 * @returns a new array, the input is not modified
 */
export const limitBlackPerRow = (
    pixels: Uint8Array,
    width: number,
    height: number,
    maxFraction = DEFAULT_MAX_FRACTION,
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
        const cellRow = Math.floor(y / CELL);
        const rank = (x: number) => bayer8(Math.floor(x / CELL), cellRow);
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
        const removeByRank = (candidates: number[]) => {
            candidates.sort((a, b) => rank(a) - rank(b) || a - b);
            const n = Math.min(excess, candidates.length);
            if (n === 0) {
                return;
            }
            // whole ranks below the cut-off go completely; of the last, partial rank only an even share goes,
            // spread along the row (taking them left to right would lighten the left edge)
            const cutoff = rank(candidates[n - 1]);
            const below = candidates.filter((x) => rank(x) < cutoff);
            const group = candidates.filter((x) => rank(x) === cutoff);
            const share = n - below.length;
            const removed = below.concat(
                Array.from({ length: share }, (_, i) => group[Math.floor((i + 0.5) * group.length / share)]));
            for (const x of removed) {
                out[y * width + x] = 255;
            }
            excess -= n;
        };
        const columns = Array.from({ length: width }, (_, x) => x);
        removeByRank(columns.filter((x) => black(x, y) && deepInterior(x)));
        if (excess > 0) {
            removeByRank(columns.filter((x) => out[y * width + x] <= threshold));
        }
    }
    return out;
};
