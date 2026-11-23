import { limitBlackPerRow, softKnee } from "./limitBlack";

const rowCounts = (pixels: Uint8Array, width: number, height: number) =>
    Array.from({ length: height }, (_, y) => pixels.slice(y * width, (y + 1) * width).filter((p) => p <= 200).length);

describe('softKnee', () => {
    test('is the identity up to the knee, then bends smoothly into the ceiling', () => {
        expect(softKnee(100, 180, 222)).toBe(100);
        expect(softKnee(180, 180, 222)).toBe(180);
        let previous = 180;
        for (let count = 181; count <= 384; count++) {
            const kept = softKnee(count, 180, 222);
            expect(kept).toBeGreaterThanOrEqual(previous);
            expect(kept - previous).toBeLessThanOrEqual(1);
            expect(kept).toBeLessThanOrEqual(222);
            previous = kept;
        }
        expect(softKnee(384, 180, 222)).toBeGreaterThan(220);
    });
});

describe('limitBlackPerRow', () => {
    test('a full black block ends up at or below the ceiling in every row', () => {
        const pixels = new Uint8Array(384 * 24).fill(0);
        const limited = limitBlackPerRow(pixels, 384, 24);
        expect(Math.max(...rowCounts(limited, 384, 24))).toBeLessThanOrEqual(222);
        // the interior is a dark halftone, not an empty area
        expect(rowCounts(limited, 384, 24)[10]).toBeGreaterThan(150);
    });

    test('rows at or below the knee are left alone', () => {
        const pixels = new Uint8Array(384 * 8).fill(255);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 180; x++) {
                pixels[y * 384 + x] = 0;
            }
        }
        expect(limitBlackPerRow(pixels, 384, 8)).toEqual(pixels);
    });

    test('a row slightly over the knee loses only a few dots, a heavy one many', () => {
        const rowOf = (dots: number) => {
            const pixels = new Uint8Array(384 * 12).fill(255);
            for (let y = 0; y < 12; y++) {
                for (let x = 0; x < dots; x++) {
                    pixels[y * 384 + x] = 0;
                }
            }
            return rowCounts(limitBlackPerRow(pixels, 384, 12), 384, 12)[6];
        };
        expect(190 - rowOf(190)).toBeLessThan(10);
        expect(384 - rowOf(384)).toBeGreaterThan(150);
    });

    test('the thinning of a heavy stripe fades out over the rows next to it', () => {
        const width = 384;
        const pixels = new Uint8Array(width * 70).fill(255);
        for (let y = 0; y < 70; y++) {
            for (let x = 100; x < 250; x++) {
                pixels[y * width + x] = 0;
            }
        }
        for (let y = 28; y < 42; y++) {
            for (let x = 0; x < width; x++) {
                pixels[y * width + x] = 0;
            }
        }
        const counts = rowCounts(limitBlackPerRow(pixels, width, 70), width, 70);
        expect(counts[2]).toBe(150); // far from the stripe, untouched
        expect(counts[26]).toBeLessThan(150); // close to it, already thinned
        // the default ramp is 3 rows: rows 25 to 27 are thinned more and more, row 24 and above are untouched
        expect(counts[24]).toBe(150);
        for (let y = 24; y < 27; y++) {
            expect(counts[y + 1]).toBeLessThan(counts[y]); // thinning grows steadily towards the stripe
        }
        expect(counts[34]).toBeLessThanOrEqual(222); // the stripe itself respects the ceiling
    });

    test('does not modify its input', () => {
        const pixels = new Uint8Array(64 * 8).fill(0);
        const copy = pixels.slice();
        limitBlackPerRow(pixels, 64, 8);
        expect(pixels).toEqual(copy);
    });

    test('keeps white text inside a black banner readable', () => {
        const width = 128;
        const pixels = new Uint8Array(width * 12).fill(0);
        for (let y = 4; y < 8; y++) {
            for (let x = 40; x < 48; x++) {
                pixels[y * width + x] = 255;
            }
        }
        const limited = limitBlackPerRow(pixels, width, 12);
        for (let y = 4; y < 8; y++) {
            for (let x = 40; x < 48; x++) {
                expect(limited[y * width + x]).toBe(255);
            }
        }
        expect(Math.max(...rowCounts(limited, width, 12))).toBeLessThanOrEqual(74);
    });

    test('respects custom options', () => {
        const limited = limitBlackPerRow(new Uint8Array(100 * 10).fill(0), 100, 10, { kneeFraction: 0.2, ceilingFraction: 0.25 });
        expect(Math.max(...rowCounts(limited, 100, 10))).toBeLessThanOrEqual(25);
    });
});
