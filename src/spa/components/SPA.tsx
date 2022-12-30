import * as React from 'react';
import { SPAContext } from './SPA.utils';
import domtoimage from "dom-to-image-more";
import useStorageState from 'react-use-storage-state';
import { Box, Button, createTheme, CssBaseline, Stack, TextField, ThemeProvider } from '@mui/material';
import EscPosGenerator from '../../EscPosGenerator';
import { RawImage } from '../../Command';

const SPA = () => {
    const ref = React.useRef<HTMLDivElement>(null);

    const [widthPx, setWidthPx] = useStorageState('printer-width-px', 384);

    const scrot = React.useCallback(async () => {
        const element = ref.current;
        if (!element) {
            throw new Error('Scrot element not found');
        }
        const rgbaPixels = await domtoimage.toPixelData(element);
        const greyPixels = new Uint8Array(Math.ceil(rgbaPixels.length / 4)); // Should always be integer
        for (var y = 0; y < (rgbaPixels.length / (4 * widthPx)); y++) {
            for (var x = 0; x < widthPx; x++) {
                const pixelAtXYOffset = 4 * (y * widthPx + x);
                const pixelAtXY = rgbaPixels.slice(pixelAtXYOffset, pixelAtXYOffset + 4);
                const greyValue = Math.ceil((pixelAtXY[0] + pixelAtXY[1] + pixelAtXY[2]) / 3);
                greyPixels.set([greyValue], x + widthPx * y);
            }
        }
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
        const { data, width } = await scrot();
        const gen = new EscPosGenerator();
        gen.addCommand(new RawImage(data, width, data.length / width));
        saveData(new Blob([gen.compile()]))
    }, [scrot, saveData]);

    const spaValue = React.useMemo(() => ({
        widthPx,
        setWidthPx,
        ref,
        scrot,
    }), [widthPx, setWidthPx, scrot]);

    const theme = React.useMemo(() => createTheme({ palette: { mode: 'dark' } }), []);

    return (
        <SPAContext.Provider value={spaValue}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Stack direction="row">
                    <Stack flexGrow={1} py="20px" px="10px" gap="5px">
                        <TextField value={widthPx} onChange={(event) => {
                            const val = Number.parseInt(event.target.value, 10);
                            if (!Number.isNaN(val)) {
                                setWidthPx(val);
                            }
                        }} label="Width in pixels" />
                        <Stack direction="row" gap="5px">
                            <Button onClick={scrot} variant="contained">Scrot</Button>
                            <Button onClick={downloadEscPos} variant="contained">Download ESC/POS</Button>
                        </Stack>
                    </Stack>
                    <Box>
                        <Box sx={{ border: '1px solid red' }}>
                            <Box ref={ref} sx={{
                                background: 'white',
                                color: 'black',
                                position: 'relative',
                                width: `${widthPx}px`,
                                fontWeight: 400,
                                fontSize: '22px',
                                overflow: 'hidden',
                                '& h1': {
                                    my: '5px',
                                }
                            }}>
                                <Box pt="1px" pb="10px" px="10px">
                                    <h1>Some stuff</h1>
                                    <ul>
                                        <li>Special stuff</li>
                                        <li>Super <b>cool</b></li>
                                    </ul>
                                    <hr />
                                    <p>Deals 4d10+3 damage.</p>
                                    <img width="100%" src="https://m.media-amazon.com/images/W/WEBP_402378-T1/images/I/41Sl3Xcl3VL._AC_.jpg" />
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
