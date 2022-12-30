import EscPosGenerator from "./EscPosGenerator";

describe('EscPosGenerator', () => {
    test('initialisation', () => {
        const generator = new EscPosGenerator();
        expect(generator.compile()).toEqual(new Uint8Array([0x1b, 0x40]));
    })

    describe('text commands', () => {
        const generator = new EscPosGenerator();
        generator
            .writeLine('This is EscPosGenerator')
            .writeLine('...')
            .writeLine('feeding 4 lines:')
            .feedLine(4);
        const buffer = generator.compile();
        test('ends correctly', () => {
            expect(buffer.slice(-4)).toEqual(new Uint8Array([0x0a, 0x0d, 0x0a, 0x0d]));
        })
    })
});
