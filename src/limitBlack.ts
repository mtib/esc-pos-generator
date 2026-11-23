/**
 * Some thermal printers cannot fire more than about half the dots of a row at once: black above that fades and a
 * full row prints nothing. Measured on the 384 dot 0456:0808 printer: bars of 192 to 224 dots print solid (one
 * calibration showed a few specks at 216), at 240 dots a solid run is lightly textured, 8 runs get mottled and the
 * 2x2 dither is still even; 288 dots are very faint, 336 almost invisible, 384 blank. ESC 7 and DC2 # make no
 * difference, and pausing between rows does not help. Defaults: knee 54% (207 dots, where the old hard cap was),
 * ceiling 58% (222 dots), ramp 3 rows.
 *
 * The limiter caps the black dots per row, but blends the effect instead of cutting at one number:
 *   - across dots per row, a soft knee: rows up to `kneeFraction` of the width are untouched, heavier rows are
 *     compressed smoothly towards `ceilingFraction` (tanh curve, slope 1 at the knee, flat at the ceiling);
 *   - down the page, the thinning strength of a heavy row fades out over `ramp` rows above and below it, so a heavy
 *     stroke does not start thinning abruptly. The heavy row itself always gets the thinning it needs.
 * Dots are removed by an ordered dither on CELL x CELL dot cells (a Bayer matrix ranks the cells, the lowest ranks
 * go first), so a heavy area becomes a halftone and a lightly thinned row loses only a few scattered cells:
 *   1. deep interior dots (everything within 2 dots is black) go first, which keeps outlines and a 2 dot margin
 *      around white text intact;
 *   2. if that is not enough, any other black dot, which turns a full width rule into a fine dotted line.
 */
export type LimitOptions = {
    /** Rows with up to this share of the width black are not touched. */
    kneeFraction?: number,
    /** No row keeps more than about this share black, however heavy it is. */
    ceilingFraction?: number,
    /** Rows over which the thinning of a heavy row fades out. */
    ramp?: number,
    /** Dots with a value at or below this are black. */
    threshold?: number,
};

export const DEFAULT_KNEE_FRACTION = 0.54;
export const DEFAULT_CEILING_FRACTION = 0.58;
export const DEFAULT_RAMP = 3;
/** Edge length in dots of one dither cell; 2 dot cells printed as dark as larger ones in the printer tests. */
export const CELL = 2;
const INTERIOR_MARGIN = 2;

/** 8 x 8 Bayer matrix value (0 to 63) by the standard recursion. */
const bayer8 = (x: number, y: number): number => {
    const level = (bx: number, by: number) => 2 * (bx ^ by) + by;
    return level(x & 1, y & 1) * 16 + level((x >> 1) & 1, (y >> 1) & 1) * 4 + level((x >> 2) & 1, (y >> 2) & 1);
};

/** Dots a row with `count` black dots keeps: unchanged up to the knee, then a smooth curve into the ceiling. */
export const softKnee = (count: number, knee: number, ceiling: number): number => {
    if (count <= knee) {
        return count;
    }
    if (ceiling <= knee) {
        return Math.min(count, ceiling);
    }
    return knee + (ceiling - knee) * Math.tanh((count - knee) / (ceiling - knee));
};

/**
 * @param pixels greyscale, row by row, dots with a value at or below `threshold` are black
 * @returns a new array, the input is not modified
 */
export const limitBlackPerRow = (
    pixels: Uint8Array,
    width: number,
    height: number,
    options: LimitOptions = {},
): Uint8Array => {
    const {
        kneeFraction = DEFAULT_KNEE_FRACTION,
        ceilingFraction = DEFAULT_CEILING_FRACTION,
        ramp = DEFAULT_RAMP,
        threshold = 200,
    } = options;
    const out = pixels.slice();
    const knee = Math.floor(width * kneeFraction);
    const ceiling = Math.floor(width * ceilingFraction);
    const black = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height && pixels[y * width + x] <= threshold;

    const counts = Array.from({ length: height }, (_, y) => {
        let count = 0;
        for (let x = 0; x < width; x++) {
            if (black(x, y)) {
                count++;
            }
        }
        return count;
    });
    // dots a row must lose to respect the knee curve, and its deep interior dots (candidates), computed lazily
    const needed = counts.map((count) => (count <= knee ? 0 : count - Math.floor(softKnee(count, knee, ceiling))));
    const deepInterior = (x: number, y: number) => {
        for (let dy = -INTERIOR_MARGIN; dy <= INTERIOR_MARGIN; dy++) {
            for (let dx = -INTERIOR_MARGIN; dx <= INTERIOR_MARGIN; dx++) {
                if (!black(x + dx, y + dy)) {
                    return false;
                }
            }
        }
        return true;
    };
    const interiorCache = new Map<number, number[]>();
    const interiorOf = (y: number): number[] => {
        let list = interiorCache.get(y);
        if (!list) {
            list = [];
            for (let x = 0; x < width; x++) {
                if (black(x, y) && deepInterior(x, y)) {
                    list.push(x);
                }
            }
            interiorCache.set(y, list);
        }
        return list;
    };
    // thinning strength of a row: the share of its black dots that must go. Neighbours inherit it with a linear fade,
    // so a heavy stroke starts thinning gradually, in proportion to the dots each neighbour has.
    const strength = needed.map((need, y) => (need === 0 ? 0 : need / counts[y]));
    const blended = strength.map((_, y) => {
        let level = 0;
        for (let k = -ramp; k <= ramp; k++) {
            const other = strength[y + k];
            if (other) {
                level = Math.max(level, other * (1 - Math.abs(k) / (ramp + 1)));
            }
        }
        return level;
    });

    for (let y = 0; y < height; y++) {
        if (blended[y] === 0 && needed[y] === 0) {
            continue;
        }
        const cellRow = Math.floor(y / CELL);
        const rank = (x: number) => bayer8(Math.floor(x / CELL), cellRow);
        const interior = interiorOf(y);
        // never less than the row needs, more when a heavier neighbour is close (only interior dots are thinned for that)
        let remove = Math.max(needed[y], Math.min(interior.length, Math.round(blended[y] * counts[y])));
        const removeByRank = (candidates: number[]) => {
            candidates.sort((a, b) => rank(a) - rank(b) || a - b);
            const n = Math.min(remove, candidates.length);
            if (n === 0) {
                return;
            }
            // whole ranks below the cut-off go completely; of the last, partial rank only an even share goes,
            // spread along the row (taking them left to right would lighten the left edge)
            const cutoff = rank(candidates[n - 1]);
            const below = candidates.filter((x) => rank(x) < cutoff);
            const group = candidates.filter((x) => rank(x) === cutoff);
            const share = n - below.length;
            for (const x of below.concat(
                Array.from({ length: share }, (_, i) => group[Math.floor((i + 0.5) * group.length / share)]))) {
                out[y * width + x] = 255;
            }
            remove -= n;
        };
        removeByRank(interior.slice());
        if (remove > 0 && needed[y] > 0) {
            const rest = [];
            for (let x = 0; x < width; x++) {
                if (out[y * width + x] <= threshold) {
                    rest.push(x);
                }
            }
            removeByRank(rest);
        }
    }
    return out;
};
