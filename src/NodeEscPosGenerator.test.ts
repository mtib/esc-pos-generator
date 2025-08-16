import NodeEscPosGenerator from "./NodeEscPosGenerator";
import { findByIds } from "usb/dist";

// Mock the USB module
jest.mock("usb/dist", () => ({
    findByIds: jest.fn(),
    LIBUSB_TRANSFER_TYPE_BULK: 2
}));

const mockFindByIds = findByIds as jest.MockedFunction<typeof findByIds>;

describe('NodeEscPosGenerator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('extends EscPosGenerator', () => {
        const generator = new NodeEscPosGenerator();
        expect(generator).toBeInstanceOf(NodeEscPosGenerator);
        expect(generator.writeChars).toBeDefined();
        expect(generator.writeLine).toBeDefined();
        expect(generator.feedLine).toBeDefined();
        expect(generator.compile).toBeDefined();
    });

    test('inherits EscPosGenerator functionality', () => {
        const generator = new NodeEscPosGenerator();
        generator.writeLine('Test line');
        
        const buffer = generator.compile();
        expect(buffer.length).toBeGreaterThan(2); // Should have more than just initialize
    });

    describe('static print method', () => {
        test('throws error when printer not found', async () => {
            mockFindByIds.mockReturnValue(undefined);
            
            const data = new Uint8Array([1, 2, 3]);
            const printerIds: [number, number] = [0x1234, 0x5678];
            
            await expect(NodeEscPosGenerator.print(data, printerIds)).rejects.toThrow('Printer not connected');
            expect(mockFindByIds).toHaveBeenCalledWith(0x1234, 0x5678);
        });

        test('throws error when device has no interfaces', async () => {
            const mockPrinter = {
                open: jest.fn(),
                close: jest.fn(),
                interfaces: undefined
            };
            mockFindByIds.mockReturnValue(mockPrinter as any);
            
            const data = new Uint8Array([1, 2, 3]);
            const printerIds: [number, number] = [0x1234, 0x5678];
            
            await expect(NodeEscPosGenerator.print(data, printerIds)).rejects.toThrow('USB device has no interfaces');
            expect(mockPrinter.open).toHaveBeenCalled();
        });

        test('throws error when device has empty interfaces array', async () => {
            const mockPrinter = {
                open: jest.fn(),
                close: jest.fn(),
                interfaces: []
            };
            mockFindByIds.mockReturnValue(mockPrinter as any);
            
            const data = new Uint8Array([1, 2, 3]);
            const printerIds: [number, number] = [0x1234, 0x5678];
            
            await expect(NodeEscPosGenerator.print(data, printerIds)).rejects.toThrow('USB device has no interfaces');
        });

        test('successfully prints data', async () => {
            const mockOutEndpoint = {
                transferType: 0,
                transfer: jest.fn((_buffer, callback) => {
                    callback(null, _buffer.length);
                })
            };
            
            const mockInterface = {
                claim: jest.fn(),
                endpoints: [{}, mockOutEndpoint]
            };
            
            const mockPrinter = {
                open: jest.fn(),
                close: jest.fn(),
                interfaces: [mockInterface]
            };
            
            mockFindByIds.mockReturnValue(mockPrinter as any);
            
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            const printerIds: [number, number] = [0x1234, 0x5678];
            
            await expect(NodeEscPosGenerator.print(data, printerIds)).resolves.not.toThrow();
            
            expect(mockPrinter.open).toHaveBeenCalled();
            expect(mockInterface.claim).toHaveBeenCalled();
            expect(mockOutEndpoint.transferType).toBe(2);
            expect(mockOutEndpoint.transfer).toHaveBeenCalledWith(
                Buffer.from(data),
                expect.any(Function)
            );
            expect(mockPrinter.close).toHaveBeenCalled();
        });

        test('handles transfer errors', async () => {
            const mockOutEndpoint = {
                transferType: 0,
                transfer: jest.fn((_buffer, callback) => {
                    callback(new Error('Transfer failed'), null);
                })
            };
            
            const mockInterface = {
                claim: jest.fn(),
                endpoints: [{}, mockOutEndpoint]
            };
            
            const mockPrinter = {
                open: jest.fn(),
                close: jest.fn(),
                interfaces: [mockInterface]
            };
            
            mockFindByIds.mockReturnValue(mockPrinter as any);
            
            const data = new Uint8Array([1, 2, 3]);
            const printerIds: [number, number] = [0x1234, 0x5678];
            
            await expect(NodeEscPosGenerator.print(data, printerIds)).rejects.toThrow('Transfer failed');
        });
    });

    describe('printData method', () => {
        test('calls static print with compiled data', async () => {
            const originalPrint = NodeEscPosGenerator.print;
            NodeEscPosGenerator.print = jest.fn().mockResolvedValue(undefined);
            
            const generator = new NodeEscPosGenerator();
            generator.writeLine('Test');
            
            const printerIds: [number, number] = [0x1234, 0x5678];
            
            await generator.printData(printerIds);
            
            expect(NodeEscPosGenerator.print).toHaveBeenCalledWith(
                generator.compile(),
                printerIds
            );
            
            NodeEscPosGenerator.print = originalPrint;
        });
    });
});