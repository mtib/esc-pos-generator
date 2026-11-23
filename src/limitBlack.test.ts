import { limitBlackPerRow } from "./limitBlack";

const rowCounts = (pixels: Uint8Array, width: number, height: number) =>
    Array.from({ length: height }, (_, y) => pixels.slice(y * width, (y + 1) * width).filter((p) => p <= 200).length);

describe('limitBlackPerRow', () => {
    test('a row only slightly over the limit loses exactly its excess', () => {
        // 12 rows, 230 black dots wide in the middle of a 384 dot row: 23 over the 207 dot limit
        const pixels = new Uint8Array(384 * 12).fill(255);
        for (let y = 0; y < 12; y++) {
            for (let x = 77; x < 307; x++) {
                pixels[y * 384 + x] = 0;
            }
        }
        const limited = limitBlackPerRow(pixels, 384, 12);
        expect(rowCounts(limited, 384, 12)[6]).toBe(207);
    });

    test('a full black block ends up at or below 54% of every row', () => {
        const pixels = new Uint8Array(384 * 24).fill(0);
        const limited = limitBlackPerRow(pixels, 384, 24);
        expect(Math.max(...rowCounts(limited, 384, 24))).toBeLessThanOrEqual(207);
        // the interior is a dark chunk pattern, not an empty area
        expect(rowCounts(limited, 384, 24)[10]).toBeGreaterThan(150);
    });

    test('rows under the limit are left alone', () => {
        const pixels = new Uint8Array(384 * 8).fill(255);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 207; x++) {
                pixels[y * 384 + x] = 0;
            }
        }
        expect(limitBlackPerRow(pixels, 384, 8)).toEqual(pixels);
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
        // the white glyph stays white
        for (let y = 4; y < 8; y++) {
            for (let x = 40; x < 48; x++) {
                expect(limited[y * width + x]).toBe(255);
            }
        }
        expect(Math.max(...rowCounts(limited, width, 12))).toBeLessThanOrEqual(69);
    });

    test('respects a custom fraction', () => {
        const limited = limitBlackPerRow(new Uint8Array(100 * 10).fill(0), 100, 10, 0.25);
        expect(Math.max(...rowCounts(limited, 100, 10))).toBeLessThanOrEqual(25);
    });
});
