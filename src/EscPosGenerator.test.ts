import EscPosGenerator from "./EscPosGenerator";
import { Characters, Raw, UNDERLINE_SINGLE, UNDERLINE_DOUBLE } from "./Command";

describe('EscPosGenerator', () => {
    test('initialisation', () => {
        const generator = new EscPosGenerator();
        expect(generator.compile()).toEqual(new Uint8Array([0x1b, 0x40]));
    })

    test('initialisation with parameters', () => {
        const generator = new EscPosGenerator({ charactersPerLine: 40, dotsPerLine: 320 });
        expect(generator.charactersPerLine).toBe(40);
        expect(generator.dotsPerLine).toBe(320);
        expect(generator.compile()).toEqual(new Uint8Array([0x1b, 0x40]));
    });

    test('addCommand adds commands to action list', () => {
        const generator = new EscPosGenerator();
        const initialActions = generator.getActions().length;
        
        generator.addCommand(new Characters('test'));
        expect(generator.getActions().length).toBe(initialActions + 1);
    });

    test('addCommand returns generator for chaining', () => {
        const generator = new EscPosGenerator();
        const result = generator.addCommand(new Raw(new Uint8Array([1, 2, 3])));
        expect(result).toBe(generator);
    });

    test('writeChars adds Characters command', () => {
        const generator = new EscPosGenerator();
        const initialActions = generator.getActions().length;
        
        generator.writeChars('Hello');
        const actions = generator.getActions();
        expect(actions.length).toBe(initialActions + 1);
        expect(actions[actions.length - 1]).toBeInstanceOf(Characters);
    });

    test('writeChars with options', () => {
        const generator = new EscPosGenerator();
        generator.writeChars('Hello', { bold: true, underline: UNDERLINE_SINGLE });
        
        const actions = generator.getActions();
        const lastCommand = actions[actions.length - 1] as Characters;
        expect(lastCommand.bold).toBe(true);
        expect(lastCommand.underline).toBe(UNDERLINE_SINGLE);
    });

    test('writeChars returns generator for chaining', () => {
        const generator = new EscPosGenerator();
        const result = generator.writeChars('test');
        expect(result).toBe(generator);
    });

    test('writeLine adds Characters and Newline commands', () => {
        const generator = new EscPosGenerator();
        const initialActions = generator.getActions().length;
        
        generator.writeLine('Hello');
        const actions = generator.getActions();
        expect(actions.length).toBe(initialActions + 2);
        expect(actions[actions.length - 2]).toBeInstanceOf(Characters);
        expect(actions[actions.length - 1].constructor.name).toBe('Newline');
    });

    test('writeLine with options', () => {
        const generator = new EscPosGenerator();
        generator.writeLine('Hello', { italics: true, underline: UNDERLINE_DOUBLE });
        
        const actions = generator.getActions();
        const textCommand = actions[actions.length - 2] as Characters;
        expect(textCommand.italics).toBe(true);
        expect(textCommand.underline).toBe(UNDERLINE_DOUBLE);
    });

    test('writeLine returns generator for chaining', () => {
        const generator = new EscPosGenerator();
        const result = generator.writeLine('test');
        expect(result).toBe(generator);
    });

    test('feedLine adds specified number of newlines', () => {
        const generator = new EscPosGenerator();
        const initialActions = generator.getActions().length;
        
        generator.feedLine(3);
        const actions = generator.getActions();
        expect(actions.length).toBe(initialActions + 1);
        
        const newlineCommand = actions[actions.length - 1];
        expect(newlineCommand.toBuffer()).toEqual(new Uint8Array([0x0a, 0x0d, 0x0a, 0x0d, 0x0a, 0x0d]));
    });

    test('feedLine defaults to single newline', () => {
        const generator = new EscPosGenerator();
        generator.feedLine();
        
        const actions = generator.getActions();
        const newlineCommand = actions[actions.length - 1];
        expect(newlineCommand.toBuffer()).toEqual(new Uint8Array([0x0a, 0x0d]));
    });

    test('feedLine returns generator for chaining', () => {
        const generator = new EscPosGenerator();
        const result = generator.feedLine(2);
        expect(result).toBe(generator);
    });

    test('getActions returns copy of actions array', () => {
        const generator = new EscPosGenerator();
        generator.writeChars('test');
        
        const actions1 = generator.getActions();
        const actions2 = generator.getActions();
        
        expect(actions1).toEqual(actions2);
        expect(actions1).not.toBe(actions2); // Different array instances
        
        actions1.pop(); // Modifying copy shouldn't affect generator
        expect(generator.getActions().length).toBeGreaterThan(actions1.length);
    });

    test('compile combines all commands into single buffer', () => {
        const generator = new EscPosGenerator();
        generator
            .writeChars('A')
            .writeChars('B')
            .feedLine();
        
        const buffer = generator.compile();
        
        // Should contain: Initialize (0x1b, 0x40) + 'A' (65) + 'B' (66) + Newline (0x0a, 0x0d)
        expect(buffer).toEqual(new Uint8Array([0x1b, 0x40, 65, 66, 0x0a, 0x0d]));
    });

    test('compile handles empty action list', () => {
        const generator = new EscPosGenerator();
        // Only has Initialize command by default
        const buffer = generator.compile();
        expect(buffer).toEqual(new Uint8Array([0x1b, 0x40]));
    });

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

    test('method chaining works correctly', () => {
        const generator = new EscPosGenerator();
        const result = generator
            .writeChars('Hello')
            .writeLine(' World')
            .feedLine(2);
        
        expect(result).toBe(generator);
        expect(generator.getActions().length).toBe(5); // Initialize + Characters + Characters + Newline + Newline
    });
});
