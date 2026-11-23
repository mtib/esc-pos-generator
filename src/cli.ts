import fs from 'node:fs/promises';
import NodeEscPosGenerator from './NodeEscPosGenerator';

export const parseUSBIds = (arg: string): [number, number] => {
    const match = /^(?:0x)?([0-9a-f]{1,4}):(?:0x)?([0-9a-f]{1,4})$/i.exec(arg);
    if (!match) {
        throw new Error('Require ids to be in form <vid_hex>:<pid_hex>.');
    }
    return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16)];
}

const printHelp = () => {
    console.log(`Usage: ${process.argv[1]} <vid_hex>:<pid_hex> [file]
    Sends a raw ESC/POS file (or stdin) to the printer.
    see lsusb for vid:pid ids`)
};

const readStdin = async (): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
};

(async () => {
    if (process.argv.length < 3 || ['-h', '--help'].includes(process.argv[2])) {
        printHelp();
        process.exit(process.argv.length < 3 ? 1 : 0);
    }
    const ids = parseUSBIds(process.argv[2]);
    const data = process.argv[3] ? await fs.readFile(process.argv[3]) : await readStdin();
    await NodeEscPosGenerator.print(Uint8Array.from(data), ids);
})().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
