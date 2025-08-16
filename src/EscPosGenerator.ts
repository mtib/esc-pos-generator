import { CharacterOptions, Characters, Command, Initialize, Newline } from "./Command";

/**
 * Configuration parameters for the ESC/POS generator.
 */
export type EscPosGeneratorParameters = {
    /** Maximum characters that fit on one line (for layout calculations) */
    charactersPerLine?: number;
    /** Maximum dots (pixels) that fit on one line (for image calculations) */
    dotsPerLine?: number;
};

/**
 * Main ESC/POS generator class that builds a queue of commands to be sent to thermal printers.
 * Supports text formatting, line feeds, and custom commands through a fluent API.
 * 
 * Commands are queued and compiled to binary data when needed, allowing for efficient
 * batch operations and memory usage.
 */
class EscPosGenerator {
    /** Maximum characters per line for layout calculations */
    readonly charactersPerLine?: number;
    /** Maximum dots per line for image calculations */
    readonly dotsPerLine?: number;
    
    /** Internal queue of commands to be executed */
    private readonly _listOfActions: Command[];

    /**
     * Creates a new ESC/POS generator with optional configuration.
     * Automatically adds an initialization command to reset the printer.
     * 
     * @param options Configuration for character and dot limits
     */
    constructor(options: EscPosGeneratorParameters = {}) {
        this.charactersPerLine = options.charactersPerLine;
        this.dotsPerLine = options.dotsPerLine;
        this._listOfActions = [new Initialize()];
    }

    /**
     * Compiles all queued commands into a single binary buffer ready for printing.
     * This method efficiently combines all command buffers into one continuous byte array.
     * 
     * @returns Binary ESC/POS data ready to send to printer
     */
    compile(): Uint8Array {
        // Pre-calculate total length to avoid buffer reallocations
        const totalLength = this._listOfActions.reduce((sum, command) => sum + command.length(), 0);
        const combinedBuffer = new Uint8Array(totalLength);
        
        // Copy each command's buffer into the combined buffer
        let offset = 0;
        for (const command of this._listOfActions) {
            const commandBuffer = command.toBuffer();
            combinedBuffer.set(commandBuffer, offset);
            offset += commandBuffer.length;
        }
        
        return combinedBuffer;
    }

    /**
     * Adds a custom command to the action queue.
     * 
     * @param command The command to add
     * @returns This generator instance for method chaining
     */
    addCommand(command: Command): EscPosGenerator {
        this._listOfActions.push(command);
        return this;
    }

    /**
     * Adds text to be printed without a line break.
     * 
     * @param chars The text to print
     * @param options Optional formatting (bold, italics, underline)
     * @returns This generator instance for method chaining
     */
    writeChars(chars: string, options?: CharacterOptions): EscPosGenerator {
        this.addCommand(new Characters(chars, options));
        return this;
    }

    /**
     * Adds text followed by a line break.
     * 
     * @param text The text to print
     * @param options Optional formatting (bold, italics, underline)
     * @returns This generator instance for method chaining
     */
    writeLine(text: string, options?: CharacterOptions): EscPosGenerator {
        this.addCommand(new Characters(text, options));
        this.addCommand(new Newline());
        return this;
    }

    /**
     * Advances the paper by the specified number of lines.
     * 
     * @param count Number of lines to advance (default: 1)
     * @returns This generator instance for method chaining
     */
    feedLine(count: number = 1): EscPosGenerator {
        this.addCommand(new Newline(count));
        return this;
    }

    /**
     * Returns a copy of the current action queue.
     * Useful for debugging or inspection without modifying the internal state.
     * 
     * @returns A copy of the command queue
     */
    getActions(): Command[] {
        return this._listOfActions.slice();
    }
};

export default EscPosGenerator;
