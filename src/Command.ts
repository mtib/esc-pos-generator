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
    italics?: boolean,
    underline?: Underline,
};

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
        const array: number[] = [];
        if (this.underline !== UNDERLINE_NONE) {
            array.push(0x1b, 0x2d, {
                [UNDERLINE_SINGLE]: 0x01,
                [UNDERLINE_DOUBLE]: 0x02,
            }[this.underline]);
        }

        const textBytes = iconv.encode(this.text, 'ascii');
        for (let i = 0; i < textBytes.byteLength; i++) {
            array.push(textBytes.readUInt8(i));
        }

        if (this.underline !== UNDERLINE_NONE) {
            array.push(0x1b, 0x2d, 0x00);
        }
        return Uint8Array.from(array);
    }
}

/**
 * Requires pre-processing of the image
 */
export class RawImage extends Command {
    pixelData: Uint8Array;
    width: number;
    height: number;
    /**
     * @param pixelData Greyscale pixels (width x height)
     * @param width 
     * @param height 
     */
    constructor(pixelData: Uint8Array, width: number, height: number) {
        super();
        if (width * height !== pixelData.length) {
            throw new Error(`Pixel data does not match provided width and height: ${pixelData.length} pixels for ${width} x ${height}.`);
        }
        if (pixelData.length % 8 !== 0) {
            throw new Error(`width x height = ${width} x ${height} = ${width * height} needs to be a multiple of 8 (${width * height} % 8) = ${(width * height) % 8}`)
        }
        this.width = width;
        this.height = height;
        this.pixelData = pixelData;
    }
    toBuffer(): Uint8Array {
        const buffer = new Uint8Array(this.length());
        buffer.set([
            0x1d, 0x76, 0x30, 0x00,
            Math.ceil(this.width % 2048 / 8), Math.floor(this.width / 2048),
            this.height % 256, Math.floor(this.height / 256),
        ], 0);
        const groupedPixels = this.pixelData.reduce((acc, next) => {
            const last = acc.at(-1);
            if (last === undefined) {
                throw new Error('Unreachable');
            }
            if (last.length === 8) {
                acc.push([next]);
            } else {
                last.push(next);
            }
            return acc;
        }, [[]] as number[][]);

        groupedPixels.forEach((greyBlock, blockIndex) => {
            buffer[8 + blockIndex] =
                greyBlock.reduce((acc, next, pixelIndex) => {
                    return acc |= (next <= 200 ? 1 : 0) << (7 - pixelIndex);
                }, 0);
        })
        return buffer;
    }
    length(): number {
        return Math.ceil(this.pixelData.length / 8 + 8);
    }
}

/**
 * Re-scales and _optimises_ the image data.
 */
export class Image extends RawImage {
    constructor(pixelData: Uint8Array, inWidth: number, inHeight: number, outWidth: number, outHeight: number) {
        throw new Error('Not implemented');
        super(pixelData, inWidth, inHeight);
    }
    toBuffer(): Uint8Array {
        throw new Error("Method not implemented.");
    }
}
