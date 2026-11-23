import iconv from "iconv-lite";

export abstract class Command {
    abstract toBuffer(): Uint8Array;
    length(): number {
        return this.toBuffer().length;
    };
};

export class Raw extends Command {
    data: Uint8Array;
    constructor(rawCommand: Uint8Array) {
        super();
        this.data = rawCommand;
    }
    toBuffer(): Uint8Array {
        return this.data;
    }
    length(): number {
        return this.data.length;
    }
}

export class Initialize extends Raw {
    constructor() {
        super(Uint8Array.from([0x1b, 0x40]));
    }
};

export class Newline extends Command {
    count: number;
    constructor(count = 1) {
        if (count <= 0) {
            throw new Error(`Can't have ${count} newlines`);
        }
        super();
        this.count = count;
    }
    toBuffer(): Uint8Array {
        const buffer = new Uint8Array(this.count * 2);
        for (let i = 0; i < this.count; i++) {
            buffer.set([0x0a, 0x0d], i * 2)
        }
        return buffer;
    }
    length(): number {
        return this.count * 2;
    }
}

export const ALIGN_LEFT = Symbol('align left');
export const ALIGN_CENTER = Symbol('align center');
export const ALIGN_RIGHT = Symbol('align right');

export type Alignment = typeof ALIGN_LEFT | typeof ALIGN_CENTER | typeof ALIGN_RIGHT;

export const UNDERLINE_NONE = Symbol('underline none');
export const UNDERLINE_SINGLE = Symbol('underline single');
export const UNDERLINE_DOUBLE = Symbol('underline double');

export type Underline = typeof UNDERLINE_NONE | typeof UNDERLINE_SINGLE | typeof UNDERLINE_DOUBLE;

export type CharacterOptions = {
    bold?: boolean,
    /** Not supported by ESC/POS, accepted for API compatibility and ignored. */
    italics?: boolean,
    underline?: Underline,
};

const UNDERLINE_MODE = {
    [UNDERLINE_NONE]: 0x00,
    [UNDERLINE_SINGLE]: 0x01,
    [UNDERLINE_DOUBLE]: 0x02,
};

/**
 * Text encoded as code page 437 (the default of virtually every printer), so
 * box drawing and common accented characters work. Unmappable characters become "?".
 */
export class Characters extends Command {
    text: string;
    italics: boolean;
    bold: boolean;
    underline: Underline;
    constructor(text: string, options: CharacterOptions = {}) {
        super();
        this.text = text;
        this.italics = !!options.italics;
        this.bold = !!options.bold;
        this.underline = options.underline || UNDERLINE_NONE;
    }
    toBuffer(): Uint8Array {
        const text = iconv.encode(this.text, 'cp437');
        const underlined = this.underline !== UNDERLINE_NONE;
        const prefix: number[] = [];
        const suffix: number[] = [];
        if (underlined) {
            prefix.push(0x1b, 0x2d, UNDERLINE_MODE[this.underline]);
            suffix.push(0x1b, 0x2d, 0x00);
        }
        if (this.bold) {
            prefix.push(0x1b, 0x45, 0x01);
            suffix.push(0x1b, 0x45, 0x00);
        }
        const out = new Uint8Array(prefix.length + text.length + suffix.length);
        out.set(prefix, 0);
        out.set(text, prefix.length);
        out.set(suffix, prefix.length + text.length);
        return out;
    }
}

/**
 * Raster image (GS v 0). Rows are padded to a full byte on the right, so any width works.
 */
export class RawImage extends Command {
    pixelData: Uint8Array;
    width: number;
    height: number;
    threshold: number;
    /**
     * @param pixelData Greyscale pixels (width x height), row by row
     * @param width
     * @param height
     * @param threshold pixels with a value at or below this are printed black
     */
    constructor(pixelData: Uint8Array, width: number, height: number, threshold = 200) {
        super();
        if (width * height !== pixelData.length) {
            throw new Error(`Pixel data does not match provided width and height: ${pixelData.length} pixels for ${width} x ${height}.`);
        }
        if (width > 0xffff * 8 || height > 0xffff) {
            throw new Error(`Image of ${width} x ${height} is too large`);
        }
        this.width = width;
        this.height = height;
        this.pixelData = pixelData;
        this.threshold = threshold;
    }
    private rowBytes(): number {
        return Math.ceil(this.width / 8);
    }
    toBuffer(): Uint8Array {
        const rowBytes = this.rowBytes();
        const buffer = new Uint8Array(this.length());
        buffer.set([
            0x1d, 0x76, 0x30, 0x00,
            rowBytes & 0xff, rowBytes >> 8,
            this.height & 0xff, this.height >> 8,
        ], 0);
        const { width, height, pixelData, threshold } = this;
        for (let y = 0; y < height; y++) {
            const rowStart = y * width;
            const outStart = 8 + y * rowBytes;
            for (let x = 0; x < width; x++) {
                if (pixelData[rowStart + x] <= threshold) {
                    buffer[outStart + (x >> 3)] |= 0x80 >> (x & 7);
                }
            }
        }
        return buffer;
    }
    length(): number {
        return 8 + this.rowBytes() * this.height;
    }
}
