import { Characters, Newline, RawImage, UNDERLINE_SINGLE } from "./Command";

describe('RawImage', () => {
    test('packs pixels MSB first with a correct header', () => {
        // 8 x 2: first row black/white alternating, second row all white
        const pixels = new Uint8Array([0, 255, 0, 255, 0, 255, 0, 255, ...new Array(8).fill(255)]);
        const buffer = new RawImage(pixels, 8, 2).toBuffer();
        expect(Array.from(buffer)).toEqual([0x1d, 0x76, 0x30, 0x00, 1, 0, 2, 0, 0b10101010, 0]);
    });

    test('pads rows whose width is not a multiple of 8', () => {
        const pixels = new Uint8Array(10 * 2).fill(0);
        const image = new RawImage(pixels, 10, 2);
        const buffer = image.toBuffer();
        expect(buffer.length).toBe(image.length());
        expect(Array.from(buffer.slice(4, 8))).toEqual([2, 0, 2, 0]);
        expect(Array.from(buffer.slice(8))).toEqual([0xff, 0b11000000, 0xff, 0b11000000]);
    });

    test('encodes wide and tall images in both header bytes', () => {
        const buffer = new RawImage(new Uint8Array(3000 * 300), 3000, 300).toBuffer();
        // 375 bytes per row, 300 rows
        expect(Array.from(buffer.slice(4, 8))).toEqual([375 & 0xff, 1, 300 & 0xff, 1]);
    });

    test('rejects mismatching dimensions', () => {
        expect(() => new RawImage(new Uint8Array(5), 2, 2)).toThrow();
    });
});

describe('Characters', () => {
    test('plain text is cp437 encoded', () => {
        expect(Array.from(new Characters('Aü€').toBuffer())).toEqual([0x41, 0x81, 0x3f]);
    });

    test('bold and underline wrap the text', () => {
        const buffer = new Characters('x', { bold: true, underline: UNDERLINE_SINGLE }).toBuffer();
        expect(Array.from(buffer)).toEqual([
            0x1b, 0x2d, 0x01, 0x1b, 0x45, 0x01, 0x78, 0x1b, 0x2d, 0x00, 0x1b, 0x45, 0x00,
        ]);
    });
});

describe('Newline', () => {
    test('rejects non-positive counts', () => {
        expect(() => new Newline(0)).toThrow();
    });
});
