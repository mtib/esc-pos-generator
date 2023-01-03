import * as React from 'react';
import { SPAContext } from './SPA.utils';
import domtoimage from "dom-to-image-more";
import useStorageState from 'react-use-storage-state';
import { Box, Button, createTheme, CssBaseline, Stack, TextField, ThemeProvider } from '@mui/material';
import EscPosGenerator from '../../EscPosGenerator';
import { RawImage } from '../../Command';
import Dither from 'canvas-dither';
import prettyMs from 'pretty-ms';
import { marked } from 'marked';

const d = (d1: Date, d2: Date) => prettyMs(d1.getTime() - d2.getTime());

const SPA = () => {
    const ref = React.useRef<HTMLDivElement>(null);

    const [widthPx, setWidthPx] = useStorageState('printer-width-px', 384);
    const [padLeftPx, setPadLeftPx] = useStorageState('printer-pad-left-px', 5);
    const [padRightPx, setPadRightPx] = useStorageState('printer-pad-right-px', 5);

    const scrot = React.useCallback(async () => {
        const element = ref.current;
        if (!element) {
            throw new Error('Scrot element not found');
        }
        const t0 = new Date();
        const canvas = await domtoimage.toCanvas(element);
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get canvas context');
        }
        const t1 = new Date();
        const rgbaPixels = Dither.atkinson(Dither.grayscale(context.getImageData(0, 0, element.scrollWidth, element.scrollHeight))).data;

        const t2 = new Date();

        const greyPixels = new Uint8Array(Math.ceil(rgbaPixels.length / 4)); // Should always be integer
        for (var y = 0; y < (rgbaPixels.length / (4 * widthPx)); y++) {
            for (var x = 0; x < widthPx; x++) {
                const pixelAtXYOffset = 4 * (y * widthPx + x);
                const pixelAtXY = rgbaPixels.slice(pixelAtXYOffset, pixelAtXYOffset + 4);
                const greyValue = Math.ceil((pixelAtXY[0] + pixelAtXY[1] + pixelAtXY[2]) / 3);
                greyPixels[x + widthPx * y] = greyValue;
            }
        }
        const t3 = new Date();
        console.log('domtoimage', d(t1, t0), 'dither', d(t2, t1), 'grey', d(t3, t2));
        return { data: greyPixels, width: element.scrollWidth };
    }, []);

    const saveData = React.useCallback((blob: Blob, filename: string = 'data.raw') => {
        var a = document.createElement("a");
        document.body.appendChild(a);
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, [])

    const downloadEscPos = React.useCallback(async () => {
        const t0 = new Date();
        const { data, width } = await scrot();
        const t1 = new Date();
        const gen = new EscPosGenerator();
        gen.addCommand(new RawImage(data, width, data.length / width));
        const t2 = new Date();
        const buffer = gen.compile();
        const t3 = new Date();
        saveData(new Blob([buffer]))
        const t4 = new Date();
        console.log('scrot', d(t1, t0), 'rawimg', d(t2, t1), 'compile', d(t3, t2), 'save', d(t4, t3));
    }, [scrot, saveData]);

    const spaValue = React.useMemo(() => ({
        widthPx,
        setWidthPx,
        ref,
        scrot,
    }), [widthPx, setWidthPx, scrot]);

    const printerRef = React.useRef<USBDevice | null>(null);

    const print = React.useCallback(async () => {
        const device = await (async () => {
            const device = printerRef.current;
            if (device) {
                return device;
            }
            const newDevice = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x0456, productId: 0x0808 }] });
            printerRef.current = newDevice;

            await newDevice.open();
            await newDevice.selectConfiguration(1);
            await newDevice.claimInterface(0);

            return newDevice;
        })();


        const { data: greyPixels, width } = await scrot();
        const gen = new EscPosGenerator();
        gen.addCommand(new RawImage(greyPixels, width, greyPixels.length / width));
        const escData = gen.compile();
        await device.transferOut(3, escData);
    }, [scrot]);

    React.useEffect(() => {
        return () => {
            const device = printerRef.current;
            if (device) {
                device.close();
                printerRef.current = null;
            }
        }
    }, []);

    const theme = React.useMemo(() => createTheme({ palette: { mode: 'dark' } }), []);

    const [content, setContent] = useStorageState("temporary-content", "# Heading\n## Subheading\nSome **text**\n- Iters\n1. Enums\n- [ ] Checkboxes\n- [x] Checkedboxes");
    const [htmlContent, setHtmlContent] = React.useState("");

    React.useEffect(() => {
        setHtmlContent(marked(content));
    }, [content]);

    return (
        <SPAContext.Provider value={spaValue}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Stack direction="row">
                    <Stack flexGrow={1} py="20px" px="10px" gap="10px">
                        <TextField value={widthPx} onChange={(event) => {
                            const val = Number.parseInt(event.target.value, 10);
                            if (!Number.isNaN(val)) {
                                setWidthPx(val);
                            }
                        }} label="Width in pixels" />
                        <TextField value={padLeftPx} onChange={(event) => {
                            const val = Number.parseInt(event.target.value, 10);
                            if (!Number.isNaN(val)) {
                                setPadLeftPx(val);
                            }
                        }} label="Left padding in pixels" />
                        <TextField value={padRightPx} onChange={(event) => {
                            const val = Number.parseInt(event.target.value, 10);
                            if (!Number.isNaN(val)) {
                                setPadRightPx(val);
                            }
                        }} label="Right padding in pixels" />
                        <Stack direction="row" gap="5px">
                            <Button onClick={downloadEscPos} variant="contained">Download ESC/POS</Button>
                            <Button onClick={print} variant="contained">Print</Button>
                        </Stack>
                        <TextField
                            label="Content"
                            multiline
                            placeholder="Content"
                            sx={{
                                flexGrow: 1,
                            }}
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                        />
                    </Stack>
                    <Box>
                        <Box sx={{ border: '1px solid red', filter: 'grayscale(100%) contrast(0.9) brightness(1.6)' }}>
                            <Box ref={ref} sx={{
                                background: 'white',
                                color: 'black',
                                position: 'relative',
                                width: `${widthPx}px`,
                                fontWeight: 500,
                                fontFamily: 'Roboto Slab',
                                fontSize: '22px',
                                lineHeight: '120%',
                                overflow: 'hidden',
                                '& h1, & h2, & h3, & h4, & h5, & h6': {
                                    fontVariant: 'small-caps',
                                    my: '15px',
                                    mb: '5px',
                                    lineHeight: '100%',
                                },
                                '& h3': {
                                    borderBottom: '3px solid #555',
                                },
                                '& b, & strong': {
                                    fontWeight: 900,
                                },
                                '& p': {
                                    my: '5px',
                                },
                                '& img': {
                                    width: '100%',
                                },
                                '& hr': {
                                    height: '3px',
                                    background: '#555',
                                    border: 'none',
                                },
                                '& input[type="checkbox"]': {
                                    width: '20px',
                                    height: '20px',
                                    position: 'relative',
                                },
                                '& input[type="checkbox"]:after': {
                                    content: '""',
                                    display: 'block',
                                    position: 'absolute',
                                    left: '0px',
                                    top: '3px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '3px',
                                    border: '3px solid black',
                                },
                                '& input[type="checkbox"]:checked:after': {
                                    content: '"X"',
                                    display: 'block',
                                    position: 'absolute',
                                    color: 'black',
                                    fontSize: '21px',
                                    lineHeight: '15px',
                                    fontWeight: 700,
                                    left: '0px',
                                    top: '3px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '3px',
                                    border: '3px solid black',
                                },
                            }}>
                                <Box pt="1px" pb="60px" pl={`${padLeftPx}px`} pr={`${padRightPx}px`} >
                                    <div dangerouslySetInnerHTML={{ __html: htmlContent }}></div>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Stack>
            </ThemeProvider>
        </SPAContext.Provider>
    )
}

export default SPA;
