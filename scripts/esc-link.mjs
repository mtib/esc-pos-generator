#!/usr/bin/env -S NODE_NO_WARNINGS=1 node
// Builds (or decodes) an esc.pos.mtib.dev preset link. Content is HTML/Markdown from a file or stdin.
// Needs Node 22.18+ (runs the TypeScript codec directly, so the CLI can never drift from the app).
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodePreset, encodePreset, RANGES, clampSetting } from "../src/spa/preset.ts";

const BASE = "https://esc.pos.mtib.dev/";
const FLAGS = {
    "--width": "widthPx",
    "--pad-left": "padLeftPx",
    "--pad-right": "padRightPx",
    "--pad-bottom": "padBottomPx",
    "--font-size": "fontSizePx",
    "--line-height": "lineHeight",
};
const MAX_SAFE_LENGTH = 8000;

const usage = () => {
    console.error(`Usage: esc-link [file] [options]      (reads stdin when no file is given)
       esc-link --decode <link or hash>

Prints a link that opens the SPA with the given content and settings preset.
Settings you leave out keep whatever the visitor has saved.

Options:
  --width <px>        paper width in pixels, ${RANGES.widthPx.min} to ${RANGES.widthPx.max} (58 mm paper is 384, 80 mm is 576)
  --pad-left <px>     ${RANGES.padLeftPx.min} to ${RANGES.padLeftPx.max}
  --pad-right <px>    ${RANGES.padRightPx.min} to ${RANGES.padRightPx.max}
  --pad-bottom <px>   ${RANGES.padBottomPx.min} to ${RANGES.padBottomPx.max}
  --font-size <px>    ${RANGES.fontSizePx.min} to ${RANGES.fontSizePx.max}
  --line-height <n>   ${RANGES.lineHeight.min} to ${RANGES.lineHeight.max}
  --preview <png>     render the dithered result (what the printer gets) to a PNG with headless Chromium
                      and print its size; nothing is opened and no link is printed
  --print             print it: renders like --preview and sends the exact pixels to the USB printer
                      (needs the printer free of the usblp driver, see the esc-pos-link skill)
  --printer <vid:pid> USB id for --print (default 0456:0808)
  --no-limit          render without the black limit (preview, print and --dump see the unthinned dither)
  --dump <file>       write the rendered pixels as raw 8 bit grey (width x height bytes) for experiments
  --open              open the link in the default browser instead of printing it
  --base <url>        app address (default ${BASE})
  --decode <x>        print the decoded JSON of a link or hash and exit
  -h, --help`);
};

const fail = (message) => {
    console.error(`esc-link: ${message}`);
    process.exit(1);
};

const args = process.argv.slice(2);
const settings = {};
let file;
let base = BASE;
let decode;
let open = false;
let previewFile;
let print = false;
let noLimit = false;
let dumpFile;
let printerId = "0456:0808";

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
        usage();
        process.exit(0);
    } else if (arg === "--base") {
        base = args[++i] ?? fail("--base needs a value");
    } else if (arg === "--preview") {
        previewFile = args[++i] ?? fail("--preview needs a file name");
    } else if (arg === "--no-limit") {
        noLimit = true;
    } else if (arg === "--dump") {
        dumpFile = args[++i] ?? fail("--dump needs a file name");
    } else if (arg === "--print") {
        print = true;
    } else if (arg === "--printer") {
        printerId = args[++i] ?? fail("--printer needs vid:pid");
    } else if (arg === "--open") {
        open = true;
    } else if (arg === "--decode") {
        decode = args[++i] ?? fail("--decode needs a value");
    } else if (arg in FLAGS) {
        const key = FLAGS[arg];
        const raw = args[++i] ?? fail(`${arg} needs a value`);
        const value = clampSetting(key, Number(raw));
        if (value === undefined) {
            fail(`${arg} needs a number, got "${raw}"`);
        }
        if (value !== Number(raw)) {
            console.error(`esc-link: ${arg} ${raw} adjusted to ${value} (allowed ${RANGES[key].min} to ${RANGES[key].max})`);
        }
        settings[key] = value;
    } else if (arg.startsWith("-") && arg !== "-") {
        fail(`unknown option ${arg}`);
    } else if (file === undefined) {
        file = arg;
    } else {
        fail("only one input file is supported");
    }
}

if (decode !== undefined) {
    const preset = decodePreset(decode.includes("#") ? decode.slice(decode.indexOf("#")) : decode);
    if (!preset) {
        fail("not a valid preset link");
    }
    console.log(JSON.stringify(preset, null, 2));
    process.exit(0);
}

if (file === undefined && process.stdin.isTTY) {
    usage();
    process.exit(1);
}
const content = fs.readFileSync(file && file !== "-" ? file : 0, "utf8").replace(/\s+$/, "");
if (content === "") {
    fail("input is empty");
}

const link = `${base.replace(/#.*$/, "")}#${encodePreset({ ...settings, content })}`;
if (link.length > MAX_SAFE_LENGTH) {
    console.error(`esc-link: link is ${link.length} characters, some chat apps and servers cut links above ${MAX_SAFE_LENGTH}`);
}
/** Loads the link in headless Chromium (muted, fresh profile) and saves the dithered canvas as a PNG. */
const renderPreview = async (url, outFile, expectedWidth, wantPixels = false, limit = true) => {
    const profile = mkdtempSync(join(tmpdir(), "esc-link-"));
    const port = 9300 + Math.floor(Math.random() * 500);
    const chrome = spawn(process.env.CHROMIUM ?? "chromium", ["--headless=new", "--mute-audio", "--no-sandbox", "--disable-gpu",
        "--hide-scrollbars", `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--window-size=1280,900", "about:blank"],
        { stdio: "ignore" });
    chrome.on("error", (error) => fail(`could not start chromium (${error.message}), set CHROMIUM to its path`));
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
        let targets;
        for (let i = 0; i < 50 && !targets; i++) {
            try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
        }
        const page = targets?.find((t) => t.type === "page") ?? fail("chromium did not start");
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve) => ws.addEventListener("open", resolve));
        let id = 0;
        const pending = new Map();
        ws.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            pending.get(message.id)?.(message);
        });
        const send = (method, params = {}) => new Promise((resolve) => {
            pending.set(++id, resolve);
            ws.send(JSON.stringify({ id, method, params }));
        });
        const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
        await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        if (!limit) {
            // the app keeps the switch in localStorage; seed it before the page loads
            await send("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.setItem('printer-limit-black', 'false')" });
        }
        await send("Page.navigate", { url });
        // the canvas is redrawn about 300 ms after each change; wait until it has the paper width and stays stable
        let rect;
        let previous = "";
        for (let i = 0; i < 100; i++) {
            await sleep(300);
            await evaluate("document.fonts.ready.then(() => true)");
            const current = await evaluate(`(() => { const c = document.querySelector('[aria-label="Receipt preview"] canvas');
                if (!c || c.width === 0) return ''; const r = c.getBoundingClientRect();
                return JSON.stringify({ x: r.x + scrollX, y: r.y + scrollY, width: c.width, height: c.height }); })()`);
            if (current && current === previous && (!expectedWidth || JSON.parse(current).width === expectedWidth)) {
                rect = JSON.parse(current);
                break;
            }
            previous = current;
        }
        if (!rect) {
            fail("the printed preview never appeared (is the 'Show printed result' switch off in this profile?)");
        }
        // the on-page canvas can be scaled by CSS; capture it at its native pixel size
        if (outFile) {
            const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...rect, scale: 1 } });
            writeFileSync(outFile, Buffer.from(shot.result.data, "base64"));
        }
        let pixels;
        if (wantPixels) {
            // the canvas holds exactly the dithered (and black limited) dots the printer gets: read the red channel
            const base64 = await evaluate(`(() => { const c = document.querySelector('[aria-label="Receipt preview"] canvas');
                const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const out = new Uint8Array(c.width * c.height);
                for (let i = 0; i < out.length; i++) out[i] = d[i * 4];
                let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode(...out.subarray(i, i + 8192)); return btoa(s); })()`);
            pixels = Uint8Array.from(Buffer.from(base64, "base64"));
        }
        ws.close();
        return { ...rect, pixels };
    } finally {
        const exited = new Promise((resolve) => chrome.once("exit", resolve));
        chrome.kill();
        await Promise.race([exited, sleep(3000)]);
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
};

/** ESC @, one GS v 0 raster image (rows padded to whole bytes, dots at or below 200 are black), then a few line feeds. */
const toEscPos = (pixels, width, height) => {
    const rowBytes = Math.ceil(width / 8);
    const out = new Uint8Array(2 + 8 + rowBytes * height + 4);
    out.set([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, height & 0xff, height >> 8]);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (pixels[y * width + x] <= 200) {
                out[10 + y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
            }
        }
    }
    out.fill(0x0a, out.length - 4);
    return out;
};

const sendToPrinter = async (bytes, id) => {
    const [vid, pid] = id.split(":").map((x) => Number.parseInt(x, 16));
    const usb = createRequire(import.meta.url)("usb");
    const device = usb.findByIds(vid, pid) ?? fail(`printer ${id} not found (plugged into a host mode USB-C port?)`);
    device.open();
    try {
        const iface = device.interfaces[0];
        if (iface.isKernelDriverActive()) {
            iface.detachKernelDriver();
        }
        iface.claim();
        const out = iface.endpoints.find((e) => e.direction === "out");
        for (let offset = 0; offset < bytes.length; offset += 4096) {
            await new Promise((resolve, reject) => out.transfer(Buffer.from(bytes.subarray(offset, offset + 4096)),
                (error) => (error ? reject(error) : resolve())));
        }
        await new Promise((resolve) => iface.release(true, () => resolve()));
    } finally {
        device.close();
    }
};

if (previewFile || print || dumpFile) {
    const rect = await renderPreview(link, previewFile, settings.widthPx ?? 384, print || Boolean(dumpFile), !noLimit);
    if (dumpFile) {
        writeFileSync(dumpFile, rect.pixels);
        console.error(`esc-link: dumped ${rect.width} x ${rect.height} grey pixels to ${dumpFile}`);
    }
    const size = `${rect.width} x ${rect.height} px, about ${Math.round(rect.height / 8)} mm of paper`;
    if (previewFile) {
        console.error(`esc-link: wrote ${previewFile} (${size})`);
    }
    if (print) {
        const bytes = toEscPos(rect.pixels, rect.width, rect.height);
        await sendToPrinter(bytes, printerId);
        console.error(`esc-link: printed ${bytes.length} bytes (${size})`);
    }
} else if (open) {
    const [command, ...commandArgs] = process.platform === "darwin" ? ["open"]
        : process.platform === "win32" ? ["cmd", "/c", "start", ""]
            : ["xdg-open"];
    const child = spawn(command, [...commandArgs, link], { stdio: "ignore", detached: true });
    child.on("error", (error) => fail(`could not open the browser (${error.message}), run without --open to get the link`));
    child.unref();
    console.error(`esc-link: opened ${base.replace(/#.*$/, "")} in the browser (${link.length} character link)`);
} else {
    console.log(link);
}
