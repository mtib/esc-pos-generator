import EscPosGenerator from "./EscPosGenerator";
import { findByIds, InEndpoint, OutEndpoint } from "usb/dist";
import { LIBUSB_TRANSFER_TYPE_BULK } from "usb/dist/usb";
import { Buffer } from 'buffer';

/**
 * Extended ESC/POS generator with USB printing capabilities for Node.js environments.
 * Inherits all text and command functionality from EscPosGenerator and adds direct USB printing.
 */
class NodeEscPosGenerator extends EscPosGenerator {

    /**
     * Sends binary data directly to a USB thermal printer.
     * 
     * @param data The binary ESC/POS data to send
     * @param printerIds Tuple of [vendorId, productId] to identify the printer
     * @throws Error if printer is not found, has no interfaces, or transfer fails
     */
    static async print(data: Uint8Array, printerIds: [number, number]): Promise<void> {
        const printer = findByIds(...printerIds);
        if (!printer) {
            throw new Error(`Printer not connected. Looking for device ${printerIds[0].toString(16)}:${printerIds[1].toString(16)}`);
        }
        
        try {
            printer.open();
            
            const printerInterface = printer.interfaces?.[0];
            if (!printerInterface) {
                throw new Error('USB device has no interfaces');
            }
            
            printerInterface.claim();
            const [, outEndpoint] = printerInterface.endpoints as [InEndpoint, OutEndpoint];

            outEndpoint.transferType = LIBUSB_TRANSFER_TYPE_BULK;
            
            await new Promise<number>((resolve, reject) => {
                outEndpoint.transfer(
                    Buffer.from(data),
                    (error, transferred) => {
                        if (error) {
                            reject(new Error(`USB transfer failed: ${error.message}`));
                            return;
                        }
                        resolve(transferred ?? 0);
                    }
                );
            });
        } finally {
            // Always close the printer connection, even if an error occurred
            try {
                printer.close();
            } catch (closeError) {
                console.warn('Warning: Failed to close printer connection:', closeError);
            }
        }
    }

    /**
     * Compiles the current command queue and sends it to the specified USB printer.
     * 
     * @param printerIds Tuple of [vendorId, productId] to identify the printer
     * @returns Promise that resolves when printing is complete
     * @throws Error if compilation fails or printer communication fails
     */
    async printData(printerIds: [number, number]): Promise<void> {
        const compiledData = this.compile();
        return NodeEscPosGenerator.print(compiledData, printerIds);
    }
}

export default NodeEscPosGenerator;
