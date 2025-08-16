import fs from 'node:fs/promises';
import NodeEscPosGenerator from './NodeEscPosGenerator';

/**
 * Parses USB vendor:product ID string into numeric tuple.
 * Expected format: "1234:5678" (hexadecimal values)
 * 
 * @param arg USB ID string in format "vid:pid"
 * @returns Tuple of [vendorId, productId] as numbers
 * @throws Error if format is invalid
 */
const parseUSBIds = (arg: string): [number, number] => {
    const match = /([0-9a-fA-F]+):([0-9a-fA-F]+)/.exec(arg);
    if (!match) {
        throw new Error('USB IDs must be in format <vid_hex>:<pid_hex> (e.g., "04b8:0202")');
    }
    return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16)];
};

/**
 * Prints usage information for the CLI.
 */
const printHelp = (): void => {
    const scriptName = process.argv[1].split('/').pop() || 'esc-pos-cli';
    console.log(`Usage: ${scriptName} <vid_hex>:<pid_hex> [file]

Arguments:
  vid_hex:pid_hex    USB Vendor ID and Product ID in hexadecimal (e.g., 04b8:0202)
  file              Optional file to print (if omitted, reads from stdin)

Examples:
  ${scriptName} 04b8:0202 receipt.txt
  echo "Hello World" | ${scriptName} 04b8:0202
  
Tip: Use 'lsusb' to find your printer's vendor:product IDs`);
};

/**
 * Main CLI entry point.
 * Handles command-line arguments and prints data to USB thermal printer.
 */
(async (): Promise<void> => {
    try {
        if (process.argv.length < 3) {
            printHelp();
            process.exit(1);
        }
        
        const ids = parseUSBIds(process.argv[2]);
        
        if (process.argv[3]) {
            // Print from file
            const data = await fs.readFile(process.argv[3]);
            await NodeEscPosGenerator.print(Uint8Array.from(data), ids);
            console.log(`Successfully printed file: ${process.argv[3]}`);
        } else {
            // Print from stdin
            const chunks: Buffer[] = [];
            
            await new Promise<void>((resolve, reject) => {
                process.stdin.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                
                process.stdin.on('end', async () => {
                    try {
                        const combinedData = Buffer.concat(chunks);
                        await NodeEscPosGenerator.print(Uint8Array.from(combinedData), ids);
                        console.log(`Successfully printed ${combinedData.length} bytes from stdin`);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
                
                process.stdin.on('error', reject);
            });
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
})();
