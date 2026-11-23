import EscPosGenerator from "./EscPosGenerator";
import { findByIds, OutEndpoint } from "usb/dist";

class NodeEscPosGenerator extends EscPosGenerator {

    static async print(data: Uint8Array, printerIds: [number, number]) {
        const printer = findByIds(...printerIds);
        if (!printer) {
            throw new Error('Printer not connected');
        }
        printer.open();
        try {
            const printerInterface = printer.interfaces?.at(0);
            if (!printerInterface) {
                throw new Error('USB device has no interfaces');
            }
            printerInterface.claim();
            try {
                const outEndpoint = printerInterface.endpoints.find(
                    (endpoint): endpoint is OutEndpoint => endpoint.direction === 'out');
                if (!outEndpoint) {
                    throw new Error('USB interface has no OUT endpoint');
                }
                await new Promise<void>((resolve, reject) => outEndpoint.transfer(
                    Buffer.from(data),
                    (error) => error ? reject(error) : resolve()));
            } finally {
                await new Promise<void>((resolve) => printerInterface.release(() => resolve()));
            }
        } finally {
            printer.close();
        }
    }

    async printData(printerIds: [number, number]) {
        return NodeEscPosGenerator.print(this.compile(), printerIds);
    }
}

export default NodeEscPosGenerator;
