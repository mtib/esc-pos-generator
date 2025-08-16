import * as React from 'react';
import { SPAContext } from './SPA.utils';
import domtoimage from "dom-to-image-more";
import useStorageState from 'react-use-storage-state';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    createTheme,
    CssBaseline,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Slider,
    Stack,
    TextField,
    ThemeProvider,
    Typography
} from '@mui/material';
import EscPosGenerator from '../../EscPosGenerator';
import { RawImage } from '../../Command';
import Dither from 'canvas-dither';
import prettyMs from 'pretty-ms';
import { marked } from 'marked';
import toast, { Toaster } from 'react-hot-toast';

const d = (d1: Date, d2: Date) => prettyMs(d1.getTime() - d2.getTime());

const SPA = () => {
    const ref = React.useRef<HTMLDivElement>(null);

    const [widthPx, setWidthPx] = useStorageState('printer-width-px', 384);
    const [padLeftPx, setPadLeftPx] = useStorageState('printer-pad-left-px', 5);
    const [padRightPx, setPadRightPx] = useStorageState('printer-pad-right-px', 5);
    const [padTopPx, setPadTopPx] = useStorageState('printer-pad-top-px', 5);
    const [padBottomPx, setPadBottomPx] = useStorageState('printer-pad-bottom-px', 25);
    const [fontSizePx, setFontSizePx] = useStorageState('printer-font-size-px', 16);
    const [lineHeight, setLineHeight] = useStorageState('printer-line-height', 1.2);
    const [fontFamily, setFontFamily] = useStorageState('printer-font-family', 'Roboto Slab');

    // Content and printer settings
    const [content, setContent] = useStorageState("temporary-content", "# Heading\n## Subheading\nSome **text**\n- Items\n1. Enums\n- [ ] Checkboxes\n- [x] Checked boxes");
    const [selectedPrinter, setSelectedPrinter] = React.useState<USBDevice | null>(null);
    const [htmlContent, setHtmlContent] = React.useState("");

    React.useEffect(() => {
        setHtmlContent(marked(content));
    }, [content]);

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
        const imageData = context.getImageData(0, 0, element.scrollWidth, element.scrollHeight);
        const rgbaPixels = Dither.atkinson(Dither.grayscale(imageData)).data;
        const t2 = new Date();

        // Optimized pixel conversion using typed array methods
        const pixelCount = rgbaPixels.length / 4;
        const greyPixels = new Uint8Array(pixelCount);

        for (let i = 0; i < pixelCount; i++) {
            const rgbaOffset = i * 4;
            // Fast RGB to greyscale conversion
            greyPixels[i] = Math.round((rgbaPixels[rgbaOffset] + rgbaPixels[rgbaOffset + 1] + rgbaPixels[rgbaOffset + 2]) / 3);
        }

        const t3 = new Date();
        toast.success(`Image processed in ${d(t3, t0)} (Canvas: ${d(t1, t0)}, Dither: ${d(t2, t1)}, Convert: ${d(t3, t2)})`);
        return { data: greyPixels, width: element.scrollWidth };
    }, [widthPx]);

    const saveData = React.useCallback((blob: Blob, filename: string = 'receipt.escpos') => {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up object URL
        URL.revokeObjectURL(url);
    }, []);

    const downloadEscPos = React.useCallback(async () => {
        try {
            const t0 = new Date();
            const { data, width } = await scrot();
            const t1 = new Date();

            const gen = new EscPosGenerator();
            gen.addCommand(new RawImage(data, width, data.length / width));
            const t2 = new Date();

            const buffer = gen.compile();
            const t3 = new Date();

            saveData(new Blob([buffer]), 'receipt.escpos');
            const t4 = new Date();

            toast.success(`Downloaded ESC/POS file (${buffer.length} bytes)`);
        } catch (error) {
            toast.error(`Failed to generate ESC/POS data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [scrot, saveData]);

    const spaValue = React.useMemo(() => ({
        widthPx,
        setWidthPx,
        ref,
        scrot,
    }), [widthPx, setWidthPx, scrot]);

    const selectPrinter = React.useCallback(async () => {
        try {
            const device = await navigator.usb.requestDevice({ filters: [] });
            setSelectedPrinter(device);
            toast.success(`Selected printer: ${device.productName} (${device.vendorId.toString(16)}:${device.productId.toString(16)})`);
        } catch (error) {
            toast.error(`Failed to select printer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [setSelectedPrinter]);

    const print = React.useCallback(async () => {
        if (!selectedPrinter) {
            await selectPrinter();
            return;
        }

        try {
            // Ensure device is properly initialized
            if (!selectedPrinter.opened) {
                await selectedPrinter.open();
                await selectedPrinter.selectConfiguration(1);
                await selectedPrinter.claimInterface(0);
            }

            const { data: greyPixels, width } = await scrot();
            const gen = new EscPosGenerator();
            gen.addCommand(new RawImage(greyPixels, width, greyPixels.length / width));
            const escData = gen.compile();

            await selectedPrinter.transferOut(3, escData);
            toast.success(`Successfully printed ${escData.length} bytes`);
        } catch (error) {
            toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Reset printer selection on error
            setSelectedPrinter(null);
        }
    }, [selectedPrinter, selectPrinter, scrot, setSelectedPrinter]);

    React.useEffect(() => {
        return () => {
            if (selectedPrinter?.opened) {
                selectedPrinter.close().catch(console.warn);
            }
        };
    }, [selectedPrinter]);

    const theme = React.useMemo(() => createTheme({
        palette: {
            mode: 'dark',
            primary: {
                main: '#90caf9',
            },
            secondary: {
                main: '#f48fb1',
            },
            background: {
                default: '#0a0a0a',
                paper: '#1a1a1a'
            }
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        textTransform: 'none',
                        fontWeight: 600
                    }
                }
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        borderRadius: 12
                    }
                }
            }
        }
    }), []);

    return (
        <>
            <SPAContext.Provider value={spaValue}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <Stack direction="row" sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)' }}>
                        {/* Controls panel - grows to use available space since receipt preview has fixed width */}
                        <Box
                            sx={{
                                flexGrow: 1,
                                height: '100vh',
                                overflow: 'auto',
                                borderRight: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <Stack
                                py={3}
                                px={3}
                                gap={3}
                                sx={{ maxWidth: '600px', mx: 'auto' }}
                            >
                                <Card elevation={2}>
                                    <CardContent sx={{ py: 2 }}>
                                        <Typography variant="h6" sx={{ mb: 0 }}>Printer Settings</Typography>
                                        <TextField
                                            value={widthPx}
                                            onChange={(event) => {
                                                const val = Number.parseInt(event.target.value, 10);
                                                if (!Number.isNaN(val)) {
                                                    setWidthPx(val);
                                                }
                                            }}
                                            label="Width (pixels)"
                                            size="small"
                                            fullWidth
                                            margin="normal"
                                        />
                                    </CardContent>
                                </Card>
                                <Card elevation={2}>
                                    <CardContent sx={{ py: 2 }}>
                                        <Typography variant="h6" sx={{ mb: 2 }}>Spacing</Typography>
                                        <Stack gap={2.5} sx={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            columnGap: 3
                                        }}>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Left ({padLeftPx}px)</Typography>
                                                <Slider
                                                    value={padLeftPx}
                                                    onChange={(_, newVal) => setPadLeftPx(newVal as number)}
                                                    max={200}
                                                    size="small"
                                                />
                                            </Box>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Right ({padRightPx}px)</Typography>
                                                <Slider
                                                    value={padRightPx}
                                                    onChange={(_, newVal) => setPadRightPx(newVal as number)}
                                                    max={200}
                                                    size="small"
                                                />
                                            </Box>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Top ({padTopPx}px)</Typography>
                                                <Slider
                                                    value={padTopPx}
                                                    onChange={(_, newVal) => setPadTopPx(newVal as number)}
                                                    max={200}
                                                    size="small"
                                                />
                                            </Box>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Bottom ({padBottomPx}px)</Typography>
                                                <Slider
                                                    value={padBottomPx}
                                                    onChange={(_, newVal) => setPadBottomPx(newVal as number)}
                                                    max={200}
                                                    size="small"
                                                />
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                </Card>
                                <Card elevation={2}>
                                    <CardContent sx={{ py: 2 }}>
                                        <Typography variant="h6" sx={{ mb: 2 }}>Typography</Typography>
                                        <Stack gap={2.5} sx={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1fr',
                                            columnGap: 3,
                                            alignItems: 'start'
                                        }}>
                                            <Box sx={{ gridColumn: '1 / -1' }}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>Font Family</InputLabel>
                                                    <Select
                                                        value={fontFamily}
                                                        label="Font Family"
                                                        onChange={(event) => setFontFamily(event.target.value)}
                                                    >
                                                        <MenuItem value="Roboto Slab">Roboto Slab</MenuItem>
                                                        <MenuItem value="Roboto">Roboto</MenuItem>
                                                        <MenuItem value="Roboto Condensed">Roboto Condensed</MenuItem>
                                                        <MenuItem value="Lora">Lora</MenuItem>
                                                        <MenuItem value="monospace">Monospace</MenuItem>
                                                        <MenuItem value="serif">Serif</MenuItem>
                                                        <MenuItem value="sans-serif">Sans Serif</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Font Size ({fontSizePx}px)</Typography>
                                                <Slider
                                                    value={fontSizePx}
                                                    onChange={(_, newVal) => setFontSizePx(newVal as number)}
                                                    max={50}
                                                    min={6}
                                                    size="small"
                                                />
                                            </Box>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Line Height ({lineHeight})</Typography>
                                                <Slider
                                                    value={lineHeight * 10}
                                                    onChange={(_, newVal) => setLineHeight(newVal as number / 10)}
                                                    max={200}
                                                    min={1}
                                                    size="small"
                                                />
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                </Card>
                                <Card elevation={2}>
                                    <CardContent sx={{ py: 2 }}>
                                        <Typography variant="h6" sx={{ mb: 2 }}>Actions</Typography>
                                        <Stack gap={1.5} direction="row" sx={{ flexWrap: 'wrap' }}>
                                            <Button
                                                onClick={downloadEscPos}
                                                variant="contained"
                                                sx={{ minWidth: '140px' }}
                                            >
                                                Download
                                            </Button>
                                            <Button
                                                onClick={selectPrinter}
                                                variant={selectedPrinter ? "contained" : "outlined"}
                                                color={selectedPrinter ? "success" : "primary"}
                                                sx={{ minWidth: '140px', flexGrow: 1 }}
                                            >
                                                {selectedPrinter ? selectedPrinter.productName : 'Select Printer'}
                                            </Button>
                                            <Button
                                                onClick={print}
                                                variant="contained"
                                                disabled={!selectedPrinter}
                                                color="secondary"
                                                sx={{ minWidth: '100px' }}
                                            >
                                                Print
                                            </Button>
                                        </Stack>
                                    </CardContent>
                                </Card>
                                <Card elevation={2}>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ mb: 1.5 }}>Content Editor</Typography>
                                        <TextField
                                            label="Markdown Content"
                                            multiline
                                            rows={12}
                                            placeholder="# Your Receipt Title\n\n**Bold text** and *italic text*\n\n- Bulleted lists\n1. Numbered lists\n- [ ] Checkboxes\n- [x] Completed items"
                                            sx={{
                                                '& .MuiInputBase-root': {
                                                    alignItems: 'flex-start'
                                                },
                                                '& .MuiInputBase-input': {
                                                    resize: 'vertical'
                                                }
                                            }}
                                            value={content}
                                            onChange={(event) => setContent(event.target.value)}
                                            fullWidth
                                        />
                                    </CardContent>
                                </Card>
                            </Stack>
                        </Box>

                        {/* Receipt preview panel - fixed width based on printer width setting */}
                        <Box sx={{
                            width: `${widthPx + 80}px`,
                            height: '100vh',
                            overflow: 'auto',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            p: 3,
                            background: 'rgba(255,255,255,0.02)',
                            minWidth: '400px'
                        }}>
                            <Paper
                                elevation={8}
                                sx={{
                                    filter: 'grayscale(100%) contrast(0.9) brightness(1.6)',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    border: '2px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <Box ref={ref} sx={{
                                    background: 'white',
                                    color: 'black',
                                    position: 'relative',
                                    width: `${widthPx}px`,
                                    fontWeight: 500,
                                    fontFamily: fontFamily,
                                    fontSize: `${fontSizePx}px`,
                                    lineHeight,
                                    overflow: 'hidden',
                                    '& h1, & h2, & h3, & h4, & h5, & h6': {
                                        fontVariant: 'small-caps',
                                        my: '15px',
                                        mb: '5px',
                                        lineHeight: '100%',
                                    },
                                    '& h3': {
                                        borderBottom: '3px solid #999',
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
                                    <Box pt={`${padTopPx}px`} pb={`${padBottomPx}px`} pl={`${padLeftPx}px`} pr={`${padRightPx}px`} >
                                        <div dangerouslySetInnerHTML={{ __html: htmlContent }}></div>
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    </Stack>
                </ThemeProvider>
            </SPAContext.Provider>
            <Toaster
                position="bottom-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#1a1a1a',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        fontSize: '14px'
                    },
                    success: {
                        iconTheme: {
                            primary: '#4ade80',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#f87171',
                            secondary: '#fff',
                        },
                    }
                }}
            />
        </>);
};

export default SPA;
