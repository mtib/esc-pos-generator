import fs from 'node:fs/promises';
import NodeEscPosGenerator from './NodeEscPosGenerator';

const parseUSBIds = (arg: string): [number, number] => {
    const match = /(\d+):(\d+)/.exec(arg);
    if (!match) {
        throw new Error('Require id\'s to be in form <vid_hex>:<pid_hex>.');
    }
    return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16)];
}

const printHelp = () => {
    console.log(`Usage: ${process.argv[1]} <vid_hex>:<pid_hex> [file]
    see lsusb for vid:pid ids`)
};

(async () => {
    if (process.argv.length < 3) {
        printHelp();
        process.exit(1);
    }
    const ids = parseUSBIds(process.argv[2]);
    if (process.argv[3]) {
        const data = await fs.readFile(process.argv[3]);
        NodeEscPosGenerator.print(Uint8Array.from(data), ids);
    } else {
        await new Promise((resolve) => {
            let count = 0;
            process.stdin.on('data', (data) => {
                count += data.byteLength;
                NodeEscPosGenerator.print(Uint8Array.from(data), ids);
            })
            process.stdin.on('close', () => { resolve(count) })
        });
    }
})();
