import { 
    Command, 
    Raw, 
    Initialize, 
    Newline, 
    Characters, 
    RawImage,
    CharacterOptions,
    ALIGN_LEFT,
    ALIGN_CENTER, 
    ALIGN_RIGHT,
    UNDERLINE_NONE,
    UNDERLINE_SINGLE,
    UNDERLINE_DOUBLE
} from "./Command";

describe('Command', () => {
    describe('Raw', () => {
        test('creates command with raw data', () => {
            const data = new Uint8Array([0x1b, 0x40]);
            const command = new Raw(data);
            expect(command.toBuffer()).toEqual(data);
            expect(command.length()).toBe(2);
        });
    });

    describe('Initialize', () => {
        test('creates initialization command', () => {
            const command = new Initialize();
            expect(command.toBuffer()).toEqual(new Uint8Array([0x1b, 0x40]));
            expect(command.length()).toBe(2);
        });
    });

    describe('Newline', () => {
        test('creates single newline by default', () => {
            const command = new Newline();
            expect(command.toBuffer()).toEqual(new Uint8Array([0x0a, 0x0d]));
            expect(command.length()).toBe(2);
        });

        test('creates multiple newlines', () => {
            const command = new Newline(3);
            expect(command.toBuffer()).toEqual(new Uint8Array([0x0a, 0x0d, 0x0a, 0x0d, 0x0a, 0x0d]));
            expect(command.length()).toBe(6);
        });

        test('throws error for invalid count', () => {
            expect(() => new Newline(0)).toThrow("Can't have 0 newlines");
            expect(() => new Newline(-1)).toThrow("Can't have -1 newlines");
        });
    });

    describe('Characters', () => {
        test('creates basic text command', () => {
            const command = new Characters('Hello');
            const buffer = command.toBuffer();
            expect(buffer).toEqual(new Uint8Array([72, 101, 108, 108, 111])); // ASCII for "Hello"
        });

        test('handles empty text', () => {
            const command = new Characters('');
            expect(command.toBuffer()).toEqual(new Uint8Array([]));
        });

        test('applies underline formatting', () => {
            const command = new Characters('Test', { underline: UNDERLINE_SINGLE });
            const buffer = command.toBuffer();
            expect(buffer[0]).toBe(0x1b); // ESC
            expect(buffer[1]).toBe(0x2d); // -
            expect(buffer[2]).toBe(0x01); // single underline
            expect(buffer.slice(-3)).toEqual(new Uint8Array([0x1b, 0x2d, 0x00])); // reset underline
        });

        test('applies double underline formatting', () => {
            const command = new Characters('Test', { underline: UNDERLINE_DOUBLE });
            const buffer = command.toBuffer();
            expect(buffer[2]).toBe(0x02); // double underline
        });

        test('no underline formatting by default', () => {
            const command = new Characters('Test');
            const buffer = command.toBuffer();
            expect(buffer).toEqual(new Uint8Array([84, 101, 115, 116])); // Just ASCII
        });

        test('stores character options correctly', () => {
            const options: CharacterOptions = { bold: true, italics: true, underline: UNDERLINE_SINGLE };
            const command = new Characters('Test', options);
            expect(command.bold).toBe(true);
            expect(command.italics).toBe(true);
            expect(command.underline).toBe(UNDERLINE_SINGLE);
        });
    });

    describe('RawImage', () => {
        test('creates valid image command', () => {
            const pixels = new Uint8Array(16); // 4x4 image
            pixels.fill(255); // white pixels
            const command = new RawImage(pixels, 4, 4);
            
            const buffer = command.toBuffer();
            expect(buffer.slice(0, 8)).toEqual(new Uint8Array([
                0x1d, 0x76, 0x30, 0x00, // Command header
                1, 0, // Width (Math.ceil(4 / 8) = 1, Math.floor(4 / 2048) = 0)
                4, 0  // Height (4 pixels)
            ]));
        });

        test('throws error for mismatched dimensions', () => {
            const pixels = new Uint8Array(15); // Wrong size
            expect(() => new RawImage(pixels, 4, 4)).toThrow(
                'Pixel data does not match provided width and height: 15 pixels for 4 x 4.'
            );
        });

        test('throws error for non-multiple of 8 pixels', () => {
            const pixels = new Uint8Array(15); // 15 is not divisible by 8
            expect(() => new RawImage(pixels, 3, 5)).toThrow(
                'width x height = 3 x 5 = 15 needs to be a multiple of 8'
            );
        });

        test('processes pixel data correctly', () => {
            const pixels = new Uint8Array(8);
            pixels.fill(150); // Grey pixels that should become black (≤200)
            const command = new RawImage(pixels, 8, 1);
            
            const buffer = command.toBuffer();
            expect(buffer[8]).toBe(0xff); // All pixels should be black (1s)
        });

        test('processes mixed pixel data', () => {
            const pixels = new Uint8Array([100, 100, 100, 100, 250, 250, 250, 250]); // 4 dark, 4 light
            const command = new RawImage(pixels, 8, 1);
            
            const buffer = command.toBuffer();
            expect(buffer[8]).toBe(0xf0); // First 4 bits set (dark pixels), last 4 clear (light pixels)
        });
    });

    describe('alignment constants', () => {
        test('alignment symbols are defined', () => {
            expect(typeof ALIGN_LEFT).toBe('symbol');
            expect(typeof ALIGN_CENTER).toBe('symbol');
            expect(typeof ALIGN_RIGHT).toBe('symbol');
        });
    });

    describe('underline constants', () => {
        test('underline symbols are defined', () => {
            expect(typeof UNDERLINE_NONE).toBe('symbol');
            expect(typeof UNDERLINE_SINGLE).toBe('symbol');
            expect(typeof UNDERLINE_DOUBLE).toBe('symbol');
        });
    });
});