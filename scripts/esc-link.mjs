#!/usr/bin/env -S NODE_NO_WARNINGS=1 node
// Builds (or decodes) an esc.pos.mtib.dev preset link. Content is HTML/Markdown from a file or stdin.
// Needs Node 22.18+ (runs the TypeScript codec directly, so the CLI can never drift from the app).
import fs from "node:fs";
import { spawn } from "node:child_process";
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

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
        usage();
        process.exit(0);
    } else if (arg === "--base") {
        base = args[++i] ?? fail("--base needs a value");
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
if (open) {
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
