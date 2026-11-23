import * as React from 'react';
import domtoimage from "dom-to-image-more";
import useStorageState from 'react-use-storage-state';
import { Button, Row, Slider, Stack, TextArea, TextField, Toast } from '../ui';
import EscPosGenerator from '../../EscPosGenerator';
import Dither from 'canvas-dither';
import { marked } from 'marked';

type Status = { severity: 'success' | 'error' | 'info', message: string } | null;

const hasWebUsb = typeof navigator !== 'undefined' && 'usb' in navigator;

/** Opens the device (once) and finds its first bulk OUT endpoint. */
const openPrinter = async (device: USBDevice): Promise<number> => {
    if (!device.opened) {
        await device.open();
    }
    if (device.configuration === null) {
        await device.selectConfiguration(1);
    }
    for (const usbInterface of device.configuration?.interfaces ?? []) {
        const alternate = usbInterface.alternates[0];
        const endpoint = alternate?.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
        if (endpoint) {
            if (!usbInterface.claimed) {
                await device.claimInterface(usbInterface.interfaceNumber);
            }
            return endpoint.endpointNumber;
        }
    }
    throw new Error('USB device has no bulk OUT endpoint, is it a printer?');
};

const SPA = () => {
    const ref = React.useRef<HTMLDivElement>(null);

    const [widthPx, setWidthPx] = useStorageState('printer-width-px', 384);
    const [padLeftPx, setPadLeftPx] = useStorageState('printer-pad-left-px', 5);
    const [padRightPx, setPadRightPx] = useStorageState('printer-pad-right-px', 5);
    const [padBottomPx, setPadBottomPx] = useStorageState('printer-pad-bottom-px', 25);
    const [fontSizePx, setFontSizePx] = useStorageState('printer-font-size-px', 16);
    const [lineHeight, setLineHeight] = useStorageState('printer-line-height', 1.2);
    const [content, setContent] = useStorageState("temporary-content", "# Heading\n## Subheading\nSome **text**\n- Iters\n1. Enums\n- [ ] Checkboxes\n- [x] Checkedboxes");

    const [busy, setBusy] = React.useState(false);
    const [status, setStatus] = React.useState<Status>(null);

    const htmlContent = React.useMemo(() => marked(content), [content]);

    /** Renders the preview, dithers it and returns the greyscale pixels. */
    const render = React.useCallback(async () => {
        const element = ref.current;
        if (!element) {
            throw new Error('Preview element not found');
        }
        const canvas = await domtoimage.toCanvas(element);
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get canvas context');
        }
        const width = element.scrollWidth;
        const height = element.scrollHeight;
        const rgba = Dither.atkinson(Dither.grayscale(context.getImageData(0, 0, width, height))).data;
        // after grayscale + dithering R, G and B are equal, so one channel is enough
        const pixels = new Uint8Array(width * height);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = rgba[i * 4];
        }
        return new EscPosGenerator().writeImage(pixels, width, height).compile();
    }, []);

    const run = React.useCallback(async (action: () => Promise<string>) => {
        setBusy(true);
        try {
            setStatus({ severity: 'success', message: await action() });
        } catch (error) {
            console.error(error);
            setStatus({ severity: 'error', message: error instanceof Error ? error.message : String(error) });
        } finally {
            setBusy(false);
        }
    }, []);

    const downloadEscPos = React.useCallback(() => run(async () => {
        const buffer = await render();
        const url = URL.createObjectURL(new Blob([buffer]));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.raw';
        a.click();
        URL.revokeObjectURL(url);
        return `Downloaded ${buffer.length} bytes`;
    }), [render, run]);

    const printerRef = React.useRef<{ device: USBDevice, endpoint: number } | null>(null);

    const print = React.useCallback(() => run(async () => {
        let printer = printerRef.current;
        if (!printer) {
            // previously authorised devices don't need the picker again
            const known = await navigator.usb.getDevices();
            const device = known.length === 1 ? known[0] : await navigator.usb.requestDevice({ filters: [] });
            printer = { device, endpoint: await openPrinter(device) };
            printerRef.current = printer;
        }
        try {
            const buffer = await render();
            await printer.device.transferOut(printer.endpoint, buffer);
            return `Printed ${buffer.length} bytes`;
        } catch (error) {
            // force a reconnect on the next attempt (unplugged, claimed elsewhere, ...)
            printerRef.current = null;
            await printer.device.close().catch(() => undefined);
            throw error;
        }
    }), [render, run]);

    React.useEffect(() => () => {
        printerRef.current?.device.close().catch(() => undefined);
        printerRef.current = null;
    }, []);

    const closeStatus = React.useCallback(() => setStatus(null), []);

    return (
        <main className="spa">
            <Stack className="spa-controls" gap={3}>
                <TextField
                    type="number"
                    label="Width in pixels"
                    value={widthPx}
                    min={8}
                    max={2048}
                    step={8}
                    onChange={(event) => {
                        const val = Number.parseInt(event.target.value, 10);
                        if (!Number.isNaN(val) && val > 0) {
                            setWidthPx(val);
                        }
                    }}
                />
                <Slider label="Left padding" value={padLeftPx} onChange={setPadLeftPx} max={30} />
                <Slider label="Right padding" value={padRightPx} onChange={setPadRightPx} max={30} />
                <Slider label="Bottom padding" value={padBottomPx} onChange={setPadBottomPx} max={80} />
                <Slider label="Font size" value={fontSizePx} onChange={setFontSizePx} min={6} max={50} />
                <Slider
                    label="Line height"
                    value={lineHeight}
                    onChange={(v) => setLineHeight(Math.round(v * 10) / 10)}
                    min={0.5}
                    max={3}
                    step={0.1}
                />
                <Row gap={2}>
                    <Button onClick={downloadEscPos} disabled={busy} variant="primary">Download ESC/POS</Button>
                    <Button
                        onClick={print}
                        disabled={busy || !hasWebUsb}
                        variant="primary"
                        title={hasWebUsb ? undefined : 'WebUSB is not available, use Chrome'}
                    >
                        Print
                    </Button>
                </Row>
                <TextArea
                    label="Content (Markdown)"
                    minRows={8}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                />
            </Stack>
            <div className="spa-preview">
                <div className="receipt-filter">
                    <div ref={ref} className="receipt" style={{ width: `${widthPx}px`, fontSize: `${fontSizePx}px`, lineHeight }}>
                        <div style={{
                            paddingTop: '1px',
                            paddingBottom: `${padBottomPx}px`,
                            paddingLeft: `${padLeftPx}px`,
                            paddingRight: `${padRightPx}px`,
                        }}>
                            <div dangerouslySetInnerHTML={{ __html: htmlContent }}></div>
                        </div>
                    </div>
                </div>
            </div>
            <Toast
                message={status?.message ?? null}
                severity={status?.severity ?? 'info'}
                autoHideMs={5000}
                onClose={closeStatus}
            />
        </main>
    )
}

export default SPA;
