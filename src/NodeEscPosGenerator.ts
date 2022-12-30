import EscPosGenerator from "./EscPosGenerator";
import { findByIds, InEndpoint, OutEndpoint } from "usb/dist";
import { LIBUSB_TRANSFER_TYPE_BULK } from "usb/dist/usb";

class NodeEscPosGenerator extends EscPosGenerator {

    async print(printerIds: [number, number]) {
        const printer = findByIds(...printerIds);
        if (!printer) {
            throw new Error('Printer not connected');
        }
        printer.open();
        const printerInterface = printer.interfaces?.at(0);
        if (!printerInterface) {
            throw new Error('USB device has no interfaces');
        }
        printerInterface.claim();
        const [, outEndpoint] = printerInterface.endpoints as [InEndpoint, OutEndpoint];

        outEndpoint.transferType = LIBUSB_TRANSFER_TYPE_BULK;
        await new Promise((resolve, reject) => outEndpoint.transfer(
            Buffer.from(this.compile()),
            (error, transferred) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(transferred);
            }));
        printer.close();
    }
}

export default NodeEscPosGenerator;
