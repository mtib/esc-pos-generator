import { CharacterOptions, Characters, Command, Initialize, Newline, RawImage } from "./Command";

export type EscPosGeneratorParameters = {
    charactersPerLine?: number,
    dotsPerLine?: number,
}

class EscPosGenerator {
    charactersPerLine?: number;
    dotsPerLine?: number;

    _listOfActions: Command[];

    constructor(options: EscPosGeneratorParameters = {}) {
        this.charactersPerLine = options?.charactersPerLine;
        this.dotsPerLine = options?.dotsPerLine;
        this._listOfActions = [new Initialize()];
    }

    compile(): Uint8Array {
        const buffers = this._listOfActions.map(c => c.toBuffer());
        const out = new Uint8Array(buffers.reduce((total, buffer) => total + buffer.length, 0));
        let offset = 0;
        for (const buffer of buffers) {
            out.set(buffer, offset);
            offset += buffer.length;
        }
        return out;
    }

    addCommand(command: Command): EscPosGenerator {
        this._listOfActions.push(command);
        return this;
    }

    writeChars(chars: string, options?: CharacterOptions): EscPosGenerator {
        this.addCommand(new Characters(chars, options));
        return this;
    }

    writeLine(text: string, options?: CharacterOptions): EscPosGenerator {
        this.addCommand(new Characters(text, options));
        this.addCommand(new Newline());
        return this;
    }

    feedLine(count: number = 1): EscPosGenerator {
        this.addCommand(new Newline(count));
        return this;
    }

    /** Greyscale pixels, row by row; see RawImage. */
    writeImage(pixels: Uint8Array, width: number, height: number): EscPosGenerator {
        this.addCommand(new RawImage(pixels, width, height));
        return this;
    }

    getActions() {
        return this._listOfActions.slice();
    }
};

export default EscPosGenerator;
