import iconv from "iconv-lite";

/**
 * Abstract base class for ESC/POS printer commands.
 * All commands must implement toBuffer() to generate the binary ESC/POS data.
 */
export abstract class Command {
    /**
     * Converts this command to its binary ESC/POS representation.
     * @returns The binary data to send to the printer
     */
    abstract toBuffer(): Uint8Array;
    
    /**
     * Gets the length of this command in bytes.
     * @returns The number of bytes this command will occupy
     */
    length(): number {
        return this.toBuffer().length;
    }
}

/**
 * A command that contains raw binary data to be sent directly to the printer.
 * Useful for sending custom ESC/POS sequences or commands not implemented by other classes.
 */
export class Raw extends Command {
    private readonly data: Uint8Array;
    
    /**
     * Creates a raw command with the specified binary data.
     * @param rawCommand The raw binary data to send to the printer
     */
    constructor(rawCommand: Uint8Array) {
        super();
        this.data = rawCommand;
    }
    
    override toBuffer(): Uint8Array {
        return this.data;
    }
    
    override length(): number {
        return this.data.length;
    }
}

/**
 * ESC/POS initialization command (ESC @).
 * Resets the printer to its default state, clearing any formatting or settings.
 */
export class Initialize extends Raw {
    constructor() {
        super(Uint8Array.from([0x1b, 0x40]));
    }
}

/**
 * Newline command that advances the paper by the specified number of lines.
 * Uses CR+LF (\r\n) sequence for proper line advancement.
 */
export class Newline extends Command {
    private readonly count: number;
    
    /**
     * Creates a newline command.
     * @param count Number of lines to advance (default: 1)
     * @throws Error if count is less than or equal to 0
     */
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
            buffer.set([0x0a, 0x0d], i * 2);
        }
        return buffer;
    }
    
    override length(): number {
        return this.count * 2;
    }
}

/** Text alignment options for ESC/POS commands */
export const ALIGN_LEFT = Symbol('align left');
export const ALIGN_CENTER = Symbol('align center');
export const ALIGN_RIGHT = Symbol('align right');

/** Text alignment type */
export type Alignment = typeof ALIGN_LEFT | typeof ALIGN_CENTER | typeof ALIGN_RIGHT;

/** Underline formatting options */
export const UNDERLINE_NONE = Symbol('underline none');
export const UNDERLINE_SINGLE = Symbol('underline single');
export const UNDERLINE_DOUBLE = Symbol('underline double');

/** Underline formatting type */
export type Underline = typeof UNDERLINE_NONE | typeof UNDERLINE_SINGLE | typeof UNDERLINE_DOUBLE;

/**
 * Formatting options for text characters.
 */
export type CharacterOptions = {
    /** Apply bold formatting */
    bold?: boolean;
    /** Apply italic formatting */
    italics?: boolean;
    /** Apply underline formatting */
    underline?: Underline;
};

/**
 * Command for printing text with optional formatting (bold, italic, underline).
 * Converts text to ASCII encoding and applies ESC/POS formatting commands.
 */
export class Characters extends Command {
    readonly text: string;
    readonly italics: boolean;
    readonly bold: boolean;
    readonly underline: Underline;
    
    /**
     * Creates a text command with optional formatting.
     * @param text The text to print
     * @param options Formatting options (bold, italics, underline)
     */
    constructor(text: string, options: CharacterOptions = {}) {
        super();
        this.text = text;
        this.italics = !!options.italics;
        this.bold = !!options.bold;
        this.underline = options.underline ?? UNDERLINE_NONE;
    }
    
    toBuffer(): Uint8Array {
        const commands: number[] = [];
        
        // Apply underline formatting if specified
        if (this.underline !== UNDERLINE_NONE) {
            const underlineCode = this.underline === UNDERLINE_SINGLE ? 0x01 : 0x02;
            commands.push(0x1b, 0x2d, underlineCode);
        }

        // Convert text to ASCII bytes
        const textBytes = iconv.encode(this.text, 'ascii');
        for (let i = 0; i < textBytes.byteLength; i++) {
            commands.push(textBytes.readUInt8(i));
        }

        // Reset underline formatting
        if (this.underline !== UNDERLINE_NONE) {
            commands.push(0x1b, 0x2d, 0x00);
        }
        
        return Uint8Array.from(commands);
    }
}

/**
 * Command for printing bitmap images using ESC/POS GS v 0 command.
 * Handles pre-processed greyscale pixel data and converts it to 1-bit monochrome for thermal printing.
 * 
 * The pixel data must be pre-processed (greyscale, properly sized) before creating this command.
 * Images are printed using a threshold of 200 - pixels <= 200 become black dots.
 */
export class RawImage extends Command {
    private readonly pixelData: Uint8Array;
    private readonly width: number;
    private readonly height: number;
    
    /** Threshold for converting greyscale to monochrome (pixels <= threshold become black) */
    private static readonly PRINT_THRESHOLD = 200;
    
    /**
     * Creates an image command from pre-processed pixel data.
     * @param pixelData Greyscale pixel values (0-255) in row-major order
     * @param width Image width in pixels
     * @param height Image height in pixels
     * @throws Error if pixel data length doesn't match dimensions or isn't divisible by 8
     */
    constructor(pixelData: Uint8Array, width: number, height: number) {
        super();
        
        if (width * height !== pixelData.length) {
            throw new Error(`Pixel data does not match provided width and height: ${pixelData.length} pixels for ${width} x ${height}.`);
        }
        
        if (pixelData.length % 8 !== 0) {
            throw new Error(`width x height = ${width} x ${height} = ${width * height} needs to be a multiple of 8 (${width * height} % 8) = ${(width * height) % 8}`);
        }
        
        this.width = width;
        this.height = height;
        this.pixelData = pixelData;
    }
    
    toBuffer(): Uint8Array {
        const buffer = new Uint8Array(this.length());
        
        // ESC/POS image header: GS v 0
        buffer.set([
            0x1d, 0x76, 0x30, 0x00,
            Math.ceil(this.width % 2048 / 8), Math.floor(this.width / 2048),
            this.height % 256, Math.floor(this.height / 256),
        ], 0);
        
        // Convert 8 greyscale pixels to 1 byte (8 bits)
        for (let i = 0; i < this.pixelData.length; i += 8) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const pixelValue = this.pixelData[i + bit];
                if (pixelValue <= RawImage.PRINT_THRESHOLD) {
                    byte |= (1 << (7 - bit));
                }
            }
            buffer[8 + (i / 8)] = byte;
        }
        
        return buffer;
    }
    
    override length(): number {
        return Math.ceil(this.pixelData.length / 8) + 8;
    }
}

/**
 * Future implementation for image scaling and optimization.
 * Currently not implemented - use RawImage with pre-processed data instead.
 * 
 * @deprecated This class is not implemented yet. Use RawImage with pre-processed pixel data.
 */
export class Image extends RawImage {
    /**
     * @param pixelData Source pixel data
     * @param inWidth Source image width
     * @param inHeight Source image height  
     * @param outWidth Target image width
     * @param outHeight Target image height
     * @throws Error - This class is not yet implemented
     */
    constructor(pixelData: Uint8Array, inWidth: number, inHeight: number, _outWidth: number, _outHeight: number) {
        throw new Error('Image scaling not implemented - use RawImage with pre-processed data');
        super(pixelData, inWidth, inHeight);
    }
    
    override toBuffer(): Uint8Array {
        throw new Error('Image scaling not implemented - use RawImage with pre-processed data');
    }
}
