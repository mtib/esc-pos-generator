import { CharacterOptions, Characters, Command, Initialize, Newline } from "./Command";

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
        const totalLength = buffers.map(buffer => buffer.length).reduce((acc, next) => acc + next, 0);

        const { collector: combinedBuffer } = buffers.reduce(({ offset, collector }, buffer) => {
            collector.set(buffer, offset)
            return { offset: offset + buffer.length, collector };
        }, { offset: 0, collector: new Uint8Array(totalLength) });

        return combinedBuffer;
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

    getActions() {
        return this._listOfActions.slice();
    }
};

export default EscPosGenerator;
