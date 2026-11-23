import * as React from 'react';
import domtoimage from "dom-to-image-more";
import useStorageState from 'react-use-storage-state';
import EscPosGenerator from '../../EscPosGenerator';
import Dither from 'canvas-dither';
import { limitBlackPerRow } from '../../limitBlack';
import { Accordion, Alert, Button, Dialog, Menu, Row, Severity, Slider, Stack, Switch, TextArea, TextField, Toast, ToggleGroup } from '../ui';
import { Cancelled, errorName, friendlyError, RenderError } from '../errors';
import { DEFAULT_CONTENT, EXAMPLES } from '../examples';
import { downloadFileName, PAPER_PRESETS, pxToMm } from '../format';
import { imageFileToDataUrl, isSavedInLocalStorage } from '../images';
import { decodePreset, DEFAULT_SETTINGS, encodePreset, Preset, RANGES, Settings } from '../preset';
import { markdownToSafeHtml } from '../sanitize';

type Status = { severity: Severity, message: string, undo?: () => void } | null;
type BusyAction = 'print' | 'download' | 'link' | 'printer' | 'image';
type UsbId = { vendorId: number, productId: number };

const CONTENT_KEY = "temporary-content";
const hasWebUsb = typeof navigator !== 'undefined' && 'usb' in navigator;
/** above this a copied link may get cut off by chat apps and some browsers */
const LONG_LINK = 8000;

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

const hex4 = (n: number) => n.toString(16).padStart(4, '0');
const deviceName = (device: USBDevice) => device.productName || `USB device ${hex4(device.vendorId)}:${hex4(device.productId)}`;

/** Opens the browser's device picker; closing it without a choice is not an error. */
const pickDevice = async (): Promise<USBDevice> => {
    try {
        return await navigator.usb.requestDevice({ filters: [] });
    } catch (error) {
        if (errorName(error) === 'NotFoundError') {
            throw new Cancelled();
        }
        throw error;
    }
};

const MARKDOWN_HELP: [string, string][] = [
    ['# Title', 'Large heading in small caps (## and ### for smaller ones, ### is underlined)'],
    ['**bold**', 'Extra bold text'],
    ['- item', 'Bullet list'],
    ['1. item', 'Numbered list'],
    ['- [ ] task', 'Empty checkbox (- [x] task for a ticked one)'],
    ['---', 'Horizontal rule'],
    ['![](link)', 'Image at full width (or paste an image into the editor)'],
    ['<div style="...">', 'HTML with inline styles, for layouts like the tea label example'],
];

const SPA = () => {
    const ref = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const editorRef = React.useRef<HTMLTextAreaElement>(null);
    const previewColumnRef = React.useRef<HTMLDivElement>(null);

    const [widthPx, setWidthPx] = useStorageState('printer-width-px', DEFAULT_SETTINGS.widthPx);
    const [padLeftPx, setPadLeftPx] = useStorageState('printer-pad-left-px', DEFAULT_SETTINGS.padLeftPx);
    const [padRightPx, setPadRightPx] = useStorageState('printer-pad-right-px', DEFAULT_SETTINGS.padRightPx);
    const [padBottomPx, setPadBottomPx] = useStorageState('printer-pad-bottom-px', DEFAULT_SETTINGS.padBottomPx);
    const [fontSizePx, setFontSizePx] = useStorageState('printer-font-size-px', DEFAULT_SETTINGS.fontSizePx);
    const [lineHeight, setLineHeight] = useStorageState('printer-line-height', DEFAULT_SETTINGS.lineHeight);
    const [content, setContent] = useStorageState(CONTENT_KEY, DEFAULT_CONTENT);
    const [settingsOpen, setSettingsOpen] = useStorageState('settings-open', false);
    const [showPrinted, setShowPrinted] = useStorageState('preview-show-printed', true);
    // many small printers fade or print nothing when more than half of a row is black (see src/limitBlack.ts)
    const [limitBlack, setLimitBlack] = useStorageState('printer-limit-black', true);
    const [savedPrinter, setSavedPrinter] = useStorageState<UsbId | null>('printer-usb-id', null);

    const settings: Settings = { widthPx, padLeftPx, padRightPx, padBottomPx, fontSizePx, lineHeight };

    const [busy, setBusy] = React.useState<BusyAction | null>(null);
    const [status, setStatus] = React.useState<Status>(null);
    const [printerName, setPrinterName] = React.useState<string | null>(null);
    const [customWidth, setCustomWidth] = React.useState(false);
    const [widthDraft, setWidthDraft] = React.useState(String(widthPx));
    const [helpOpen, setHelpOpen] = React.useState(false);
    const [linkFallback, setLinkFallback] = React.useState<string | null>(null);
    const [receiptSize, setReceiptSize] = React.useState({ width: 0, height: 0 });
    const [columnWidth, setColumnWidth] = React.useState(0);
    const previewRef = React.useRef<HTMLElement>(null);
    const [previewSticky, setPreviewSticky] = React.useState(true);
    const [printedReady, setPrintedReady] = React.useState(false);
    const [previewError, setPreviewError] = React.useState<string | null>(null);

    const htmlContent = React.useMemo(() => markdownToSafeHtml(content), [content]);

    React.useEffect(() => setWidthDraft(String(widthPx)), [widthPx]);

    // keep the latest values for callbacks that run after an await
    const latest = React.useRef({ content, settings });
    latest.current = { content, settings };

    const applySettings = React.useCallback((next: Partial<Settings>) => {
        if (next.widthPx !== undefined) setWidthPx(next.widthPx);
        if (next.padLeftPx !== undefined) setPadLeftPx(next.padLeftPx);
        if (next.padRightPx !== undefined) setPadRightPx(next.padRightPx);
        if (next.padBottomPx !== undefined) setPadBottomPx(next.padBottomPx);
        if (next.fontSizePx !== undefined) setFontSizePx(next.fontSizePx);
        if (next.lineHeight !== undefined) setLineHeight(next.lineHeight);
    }, [setWidthPx, setPadLeftPx, setPadRightPx, setPadBottomPx, setFontSizePx, setLineHeight]);

    /** Applies a preset and returns a function that restores what was there before. */
    const applyPreset = React.useCallback((preset: Preset): () => void => {
        const before = { ...latest.current.settings, content: latest.current.content };
        applySettings(preset);
        if (preset.content !== undefined) {
            setContent(preset.content);
        }
        if (preset.widthPx !== undefined && !PAPER_PRESETS.some(p => p.widthPx === preset.widthPx)) {
            setCustomWidth(true);
        }
        return () => {
            applySettings(before);
            setContent(before.content);
        };
    }, [applySettings, setContent]);

    // a preset in the URL hash overrides the saved state once, then the hash is removed so a reload keeps edits
    React.useEffect(() => {
        const loadFromHash = () => {
            const preset = decodePreset(window.location.hash);
            if (!preset) {
                return;
            }
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            const undo = applyPreset(preset);
            setStatus({ severity: 'info', message: 'Loaded the content and settings from the link.', undo });
        };
        loadFromHash();
        window.addEventListener('hashchange', loadFromHash);
        return () => window.removeEventListener('hashchange', loadFromHash);
    }, [applyPreset]);

    /** Rasterises the preview node and dithers it; the printed result and the printer get the same pixels. */
    const rasterise = React.useCallback(async (): Promise<ImageData> => {
        const element = ref.current;
        if (!element) {
            throw new Error('Preview element not found');
        }
        let canvas: HTMLCanvasElement;
        try {
            canvas = await domtoimage.toCanvas(element);
        } catch (error) {
            throw new RenderError(error);
        }
        // The paper is exactly clientWidth dots wide. Never use scrollWidth: content that overflows the paper (even by a
        // dot) makes it larger, the raster rows then no longer fit the print head, and anything outside the rendered
        // canvas would read as transparent black. Flatten onto white at the paper size instead, cropping any overflow.
        const width = element.clientWidth;
        const height = element.scrollHeight;
        const flat = document.createElement('canvas');
        flat.width = width;
        flat.height = height;
        const context = flat.getContext('2d');
        if (!context) {
            throw new Error('Failed to get canvas context');
        }
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
        context.drawImage(canvas, 0, 0);
        try {
            const image = Dither.atkinson(Dither.grayscale(context.getImageData(0, 0, width, height)));
            if (!limitBlack) {
                return image;
            }
            // after grayscale + dithering R, G and B are equal, so one channel is enough
            const pixels = new Uint8Array(width * height);
            for (let i = 0; i < pixels.length; i++) {
                pixels[i] = image.data[i * 4];
            }
            const limited = limitBlackPerRow(pixels, width, height);
            for (let i = 0; i < limited.length; i++) {
                image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = limited[i];
            }
            return image;
        } catch (error) {
            throw new RenderError(error);
        }
    }, [limitBlack]);

    /** Renders the preview, dithers it and returns the ESC/POS bytes. */
    const render = React.useCallback(async () => {
        const image = await rasterise();
        const rgba = image.data;
        // after grayscale + dithering R, G and B are equal, so one channel is enough
        const pixels = new Uint8Array(image.width * image.height);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = rgba[i * 4];
        }
        return new EscPosGenerator().writeImage(pixels, image.width, image.height).compile();
    }, [rasterise]);

    // printed result: the dithered pixels drawn over the HTML preview, refreshed shortly after each change
    React.useEffect(() => {
        if (!showPrinted) {
            return undefined;
        }
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                await document.fonts.ready;
                const image = await rasterise();
                const canvas = canvasRef.current;
                if (cancelled || !canvas) {
                    return;
                }
                canvas.width = image.width;
                canvas.height = image.height;
                canvas.getContext('2d')?.putImageData(image, 0, 0);
                setPrintedReady(true);
                setPreviewError(null);
            } catch (error) {
                if (!cancelled) {
                    setPreviewError(friendlyError(error));
                }
            }
        }, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [showPrinted, rasterise, htmlContent, widthPx, padLeftPx, padRightPx, padBottomPx, fontSizePx, lineHeight]);

    // receipt size for the size line, and the preview column width for scaling the paper on narrow screens
    React.useEffect(() => {
        const element = ref.current;
        const column = previewColumnRef.current;
        if (!element || !column) {
            return undefined;
        }
        // pin the preview only when all of it fits the window, 24px margin above and below (--space-5)
        const updateSticky = () => {
            const preview = previewRef.current;
            if (preview) {
                setPreviewSticky(preview.offsetHeight <= window.innerHeight - 48);
            }
        };
        const observer = new ResizeObserver(() => {
            setReceiptSize({ width: element.clientWidth, height: element.scrollHeight });
            setColumnWidth(column.clientWidth);
            updateSticky();
        });
        observer.observe(element);
        observer.observe(column);
        window.addEventListener('resize', updateSticky);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateSticky);
        };
    }, []);

    const run = React.useCallback(async (action: BusyAction, work: () => Promise<Exclude<Status, null> | string | null>) => {
        setBusy(action);
        try {
            const result = await work();
            if (result !== null) {
                setStatus(typeof result === 'string' ? { severity: 'success', message: result } : result);
            }
        } catch (error) {
            if (!(error instanceof Cancelled)) {
                console.error(error);
                setStatus({ severity: 'error', message: friendlyError(error) });
            }
        } finally {
            setBusy(null);
        }
    }, []);

    const downloadEscPos = React.useCallback(() => run('download', async () => {
        const buffer = await render();
        const firstLine = ref.current?.innerText.split('\n').find(line => line.trim() !== '') ?? '';
        const name = downloadFileName(firstLine, new Date());
        const url = URL.createObjectURL(new Blob([buffer]));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        return `Downloaded ${name} (${buffer.length} bytes)`;
    }), [render, run]);

    const printerRef = React.useRef<{ device: USBDevice, endpoint: number } | null>(null);

    const forgetConnection = React.useCallback(async () => {
        const printer = printerRef.current;
        printerRef.current = null;
        await printer?.device.close().catch(() => undefined);
    }, []);

    const connect = React.useCallback(async (device: USBDevice) => {
        const printer = { device, endpoint: await openPrinter(device) };
        printerRef.current = printer;
        setPrinterName(deviceName(device));
        setSavedPrinter({ vendorId: device.vendorId, productId: device.productId });
        return printer;
    }, [setSavedPrinter]);

    /** A previously authorised device: the remembered one, or the only one. Needs no picker. */
    const findKnownDevice = React.useCallback(async (): Promise<USBDevice | undefined> => {
        const known = await navigator.usb.getDevices();
        const remembered = savedPrinter
            ? known.find(d => d.vendorId === savedPrinter.vendorId && d.productId === savedPrinter.productId)
            : undefined;
        return remembered ?? (known.length === 1 ? known[0] : undefined);
    }, [savedPrinter]);

    React.useEffect(() => {
        if (!hasWebUsb) {
            return undefined;
        }
        findKnownDevice().then(device => device && setPrinterName(deviceName(device))).catch(() => undefined);
        const onDisconnect = (event: USBConnectionEvent) => {
            if (printerRef.current?.device === event.device) {
                printerRef.current = null;
            }
        };
        navigator.usb.addEventListener('disconnect', onDisconnect);
        return () => navigator.usb.removeEventListener('disconnect', onDisconnect);
    }, [findKnownDevice]);

    const print = React.useCallback(() => run('print', async () => {
        let printer = printerRef.current;
        if (!printer) {
            printer = await connect((await findKnownDevice()) ?? (await pickDevice()));
        }
        const buffer = await render();
        try {
            await printer.device.transferOut(printer.endpoint, buffer);
        } catch (error) {
            // force a reconnect on the next attempt (unplugged, claimed elsewhere, ...)
            await forgetConnection();
            throw error;
        }
        return `Sent ${buffer.length} bytes to ${deviceName(printer.device)}`;
    }), [connect, findKnownDevice, forgetConnection, render, run]);

    const changePrinter = React.useCallback(() => run('printer', async () => {
        const device = await pickDevice();
        await forgetConnection();
        await connect(device);
        return `Printing to ${deviceName(device)}`;
    }), [connect, forgetConnection, run]);

    React.useEffect(() => () => {
        printerRef.current?.device.close().catch(() => undefined);
        printerRef.current = null;
    }, []);

    const copyLink = React.useCallback(() => run('link', async () => {
        const hash = encodePreset({ content: latest.current.content, ...latest.current.settings });
        const url = `${window.location.origin}${window.location.pathname}#${hash}`;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            setLinkFallback(url);
            return null;
        }
        return url.length > LONG_LINK
            ? { severity: 'warning', message: `Link copied. It is very long (${url.length} characters, usually because of images), so some apps may cut it off.` }
            : 'Link copied. It opens this content and these settings.';
    }), [run]);

    const insertImages = React.useCallback((files: File[]) => {
        const editor = editorRef.current;
        const start = editor?.selectionStart ?? latest.current.content.length;
        const end = editor?.selectionEnd ?? start;
        return run('image', async () => {
            const { widthPx: width, padLeftPx: left, padRightPx: right } = latest.current.settings;
            const maxWidth = Math.max(1, width - left - right);
            let snippet = '';
            let scaledTo = 0;
            for (const file of files) {
                const { dataUrl, width: imageWidth } = await imageFileToDataUrl(file, maxWidth);
                snippet += `\n![](${dataUrl})\n`;
                scaledTo = Math.max(scaledTo, imageWidth);
            }
            const current = latest.current.content;
            const next = current.slice(0, start) + snippet + current.slice(end);
            setContent(next);
            if (!isSavedInLocalStorage(CONTENT_KEY, next)) {
                return {
                    severity: 'warning',
                    message: 'The image was added and will print, but it is too large to save in this browser. '
                        + 'It will be gone after a reload. A smaller image or fewer images will fit.',
                };
            }
            return `Image added (${scaledTo} px wide, to fit the paper)`;
        });
    }, [run, setContent]);

    const imageFiles = (list: FileList | undefined | null) =>
        Array.from(list ?? []).filter(file => file.type.startsWith('image/'));

    const resetSettings = () => {
        applySettings(DEFAULT_SETTINGS);
        setCustomWidth(false);
    };

    const clearContent = () => {
        const before = latest.current.content;
        setContent('');
        setStatus({ severity: 'info', message: 'Content cleared.', undo: () => setContent(before) });
        editorRef.current?.focus();
    };

    const loadExample = (name: string, preset: Preset) => {
        const undo = applyPreset(preset);
        setStatus({ severity: 'info', message: `Loaded the ${name.toLowerCase()} example.`, undo });
    };

    const closeStatus = React.useCallback(() => setStatus(null), []);

    const paperPreset = PAPER_PRESETS.find(p => p.widthPx === widthPx);
    const widthChoice = customWidth || !paperPreset ? 'custom' : String(widthPx);
    const widthNumber = Number(widthDraft);
    const widthError = Number.isInteger(widthNumber) && widthNumber >= RANGES.widthPx.min && widthNumber <= RANGES.widthPx.max
        ? undefined
        : `Enter a whole number from ${RANGES.widthPx.min} to ${RANGES.widthPx.max}`;
    const settingsSummary = `${paperPreset ? `${paperPreset.label} (${widthPx} px)` : `${widthPx} px wide`}, font size ${fontSizePx} px`;

    // scale the paper down (never up) when the column is narrower than the receipt; the receipt node itself
    // keeps its real size because rasterising reads its layout
    const scale = columnWidth > 0 ? Math.min(1, columnWidth / widthPx) : 1;
    const busyAny = busy !== null;
    const primaryAction = hasWebUsb ? print : downloadEscPos;

    return (
        <main className="spa">
            <Stack className="spa-controls" gap={4}>
                <Row className="spa-header">
                    <h1>Receipt Printer</h1>
                    <Button variant="text" onClick={() => setHelpOpen(true)}>Markdown help</Button>
                </Row>
                {!hasWebUsb && (
                    <Alert severity="info">
                        Printing over USB needs Chrome or Edge on a computer. You can still download the ESC/POS file
                        and send it to the printer another way.
                    </Alert>
                )}
                <TextArea
                    ref={editorRef}
                    label="Content (Markdown)"
                    minRows={12}
                    value={content}
                    spellCheck
                    hint={`Paste or drop an image to add it. Press Ctrl+Enter to ${hasWebUsb ? 'print' : 'download'}.`}
                    onChange={(event) => setContent(event.target.value)}
                    onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            if (!busyAny) {
                                primaryAction();
                            }
                        }
                    }}
                    onPaste={(event) => {
                        const files = imageFiles(event.clipboardData?.files);
                        if (files.length > 0) {
                            event.preventDefault();
                            insertImages(files);
                        }
                    }}
                    onDragOver={(event) => {
                        if (Array.from(event.dataTransfer.items).some(item => item.kind === 'file')) {
                            event.preventDefault();
                        }
                    }}
                    onDrop={(event) => {
                        const files = imageFiles(event.dataTransfer?.files);
                        if (files.length > 0) {
                            event.preventDefault();
                            insertImages(files);
                        }
                    }}
                />
                <Row gap={2}>
                    {hasWebUsb && <Button variant="primary" onClick={print} busy={busy === 'print'} disabled={busyAny}>Print</Button>}
                    <Button
                        variant={hasWebUsb ? 'secondary' : 'primary'}
                        onClick={downloadEscPos}
                        busy={busy === 'download'}
                        disabled={busyAny}
                    >
                        Download ESC/POS
                    </Button>
                    <Button onClick={copyLink} busy={busy === 'link'} disabled={busyAny}>Copy link</Button>
                    <Menu
                        label="Examples"
                        disabled={busyAny}
                        items={EXAMPLES.map(example => ({ label: example.name, onSelect: () => loadExample(example.name, example.preset) }))}
                    />
                    <Button variant="text" onClick={clearContent} disabled={busyAny || content === ''}>Clear</Button>
                </Row>
                {hasWebUsb && (
                    <Row className="ui-small">
                        <span className="ui-dim">{printerName ? `Printer: ${printerName}` : 'No printer chosen yet.'}</span>
                        <Button variant="text" size="small" onClick={changePrinter} busy={busy === 'printer'} disabled={busyAny}>
                            {printerName ? 'Change printer' : 'Choose printer'}
                        </Button>
                    </Row>
                )}
                <Accordion title="Layout settings" secondary={settingsSummary} open={settingsOpen} onToggle={setSettingsOpen}>
                    <Stack gap={4}>
                        <ToggleGroup
                            label="Paper width"
                            value={widthChoice}
                            options={[
                                ...PAPER_PRESETS.map(p => ({ value: String(p.widthPx), label: `${p.label} (${p.widthPx} px)` })),
                                { value: 'custom', label: 'Custom' },
                            ]}
                            onChange={(choice) => {
                                if (choice === 'custom') {
                                    setCustomWidth(true);
                                } else {
                                    setCustomWidth(false);
                                    setWidthPx(Number(choice));
                                }
                            }}
                        />
                        {widthChoice === 'custom' && (
                            <TextField
                                type="number"
                                label="Width in pixels"
                                inputMode="numeric"
                                value={widthDraft}
                                min={RANGES.widthPx.min}
                                max={RANGES.widthPx.max}
                                error={widthError}
                                hint="Printable dots of the print head, 8 per millimetre on most printers"
                                onChange={(event) => {
                                    setWidthDraft(event.target.value);
                                    const val = Number(event.target.value);
                                    if (Number.isInteger(val) && val >= RANGES.widthPx.min && val <= RANGES.widthPx.max) {
                                        setWidthPx(val);
                                    }
                                }}
                                onBlur={() => setWidthDraft(String(widthPx))}
                            />
                        )}
                        <Slider label="Left padding" unit="px" value={padLeftPx} onChange={setPadLeftPx} {...RANGES.padLeftPx} />
                        <Slider label="Right padding" unit="px" value={padRightPx} onChange={setPadRightPx} {...RANGES.padRightPx} />
                        <Slider label="Bottom padding" unit="px" value={padBottomPx} onChange={setPadBottomPx} {...RANGES.padBottomPx} />
                        <Slider label="Font size" unit="px" value={fontSizePx} onChange={setFontSizePx} {...RANGES.fontSizePx} />
                        <Slider
                            label="Line height"
                            value={lineHeight}
                            onChange={(v) => setLineHeight(Math.round(v * 10) / 10)}
                            {...RANGES.lineHeight}
                        />
                        <Row>
                            <Button size="small" onClick={resetSettings}>Reset to defaults</Button>
                        </Row>
                    </Stack>
                </Accordion>
            </Stack>
            <section
                ref={previewRef}
                className={`spa-preview ui-focusable${previewSticky ? ' spa-preview--sticky' : ''}`}
                aria-label="Receipt preview"
                tabIndex={0}
                style={{ ['--paper-width' as string]: `${widthPx}px` }}
            >
                <Switch label="Show printed result (dithered)" checked={showPrinted} onChange={setShowPrinted} />
                <Switch label="Limit black per row (for printers that fade on large black areas)" checked={limitBlack} onChange={setLimitBlack} />
                <div ref={previewColumnRef} className="spa-paper-column">
                    <div
                        className="spa-paper"
                        style={{
                            width: widthPx * scale,
                            height: receiptSize.height > 0 ? receiptSize.height * scale : undefined,
                        }}
                    >
                        <div className="spa-paper-scale" style={{ width: widthPx, transform: scale < 1 ? `scale(${scale})` : undefined }}>
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
                            <canvas
                                ref={canvasRef}
                                className="spa-printed"
                                // crisp dots at full size; when shrunk, nearest neighbour would drop whole rows
                                style={{ imageRendering: scale < 1 ? 'auto' : 'pixelated' }}
                                aria-hidden="true"
                                hidden={!showPrinted || !printedReady}
                            />
                        </div>
                    </div>
                </div>
                <p className="spa-size ui-small ui-dim">
                    {receiptSize.width} x {receiptSize.height} px
                    <br />
                    About {pxToMm(receiptSize.height)} mm of paper (at 203 dpi)
                </p>
                {previewError && <Alert severity="warning">{previewError}</Alert>}
            </section>
            <Toast
                message={status?.message ?? null}
                severity={status?.severity ?? 'info'}
                autoHideMs={status?.severity === 'error' ? undefined : status?.undo ? 8000 : 5000}
                action={status?.undo && (
                    <Button variant="text" size="small" onClick={() => { status.undo?.(); setStatus(null); }}>Undo</Button>
                )}
                onClose={closeStatus}
            />
            <Dialog title="Markdown help" open={helpOpen} onClose={() => setHelpOpen(false)}>
                <table className="spa-help">
                    <thead>
                        <tr><th scope="col">You type</th><th scope="col">You get</th></tr>
                    </thead>
                    <tbody>
                        {MARKDOWN_HELP.map(([syntax, result]) => (
                            <tr key={syntax}><td><code>{syntax}</code></td><td>{result}</td></tr>
                        ))}
                    </tbody>
                </table>
                <p className="ui-small ui-dim">
                    Thin lines and light greys may vanish when the receipt is dithered to black and white.
                    Turn on the printed result to check.
                </p>
            </Dialog>
            <Dialog title="Copy this link" open={linkFallback !== null} onClose={() => setLinkFallback(null)}>
                <TextField
                    label="Link to this content and these settings"
                    readOnly
                    value={linkFallback ?? ''}
                    onFocus={(event) => event.target.select()}
                    hint="The browser did not allow copying automatically. Select the link and copy it."
                />
            </Dialog>
        </main>
    )
}

export default SPA;
