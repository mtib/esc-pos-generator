#!/usr/bin/env -S NODE_NO_WARNINGS=1 node
// Prints one test page with solid black blocks under different thermal head settings, to find out which
// heating commands a printer understands and which one gives the blackest black.
//   scripts/heat-test.mjs [--dry out.raw] [vid:pid]      (default 0456:0808)
// Each block is preceded by its command and then a label line. If the printer does not know a command,
// its parameter bytes print as garbage characters in that label line.
import fs from "node:fs";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const dryIndex = args.indexOf("--dry");
const dryFile = dryIndex >= 0 ? args.splice(dryIndex, 2)[1] : undefined;
const [vid, pid] = (args.find((a) => /^[0-9a-f]+:[0-9a-f]+$/i.test(a)) ?? "0456:0808").split(":").map((x) => Number.parseInt(x, 16));

const text = (s) => [...Buffer.from(s + "\n", "latin1")];
const block = (widthPx, heightPx) => {
    const rowBytes = widthPx / 8;
    return [0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, heightPx & 0xff, heightPx >> 8,
        ...new Array(rowBytes * heightPx).fill(0xff)];
};
const feed = (n) => new Array(n).fill(0x0a);

// ESC 7 n1 n2 n3: max heating dots = (n1 + 1) * 8, heating time = n2 * 10 us, heating interval = n3 * 10 us
// (common defaults 7, 80, 2). DC2 # n: bits 0 to 4 density, bits 5 to 7 break time.
const ESC7 = (n1, n2, n3) => [0x1b, 0x37, n1, n2, n3];
const DC2_HASH = (n) => [0x12, 0x23, n];
const variants = [
    { label: "A no commands", cmd: [] },
    { label: "B ESC 7 7 160 2 (longer heat)", cmd: ESC7(7, 160, 2) },
    { label: "C ESC 7 7 80 40 (slower lines)", cmd: ESC7(7, 80, 40) },
    { label: "D ESC 7 3 160 40 (fewer dots, slowest)", cmd: ESC7(3, 160, 40) },
    { label: "E DC2 # 20 (density)", cmd: [...ESC7(7, 80, 2), ...DC2_HASH(20)] },
];

// Round 1 found: ESC 7 takes ONE parameter on the 0456:0808 printer (a three parameter form prints its
// extra bytes as text), DC2 # n is accepted silently, and every solid block printed faint grey.
// Round 2 (--round 2) compares density, strip-wise sending with pauses, a checker pattern and a short block.
// A transfer is a { bytes, pauseMs } segment: the pause after it lets the head and the supply recover.
const round = Number(args.includes("--round") ? args[args.indexOf("--round") + 1] : 1);
const segments = [];
const add = (bytes, pauseMs = 0) => segments.push({ bytes: Uint8Array.from(bytes), pauseMs });
const checker = (widthPx, heightPx) => {
    const rowBytes = widthPx / 8;
    return [0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, heightPx & 0xff, heightPx >> 8,
        ...Array.from({ length: heightPx }, (_, y) => new Array(rowBytes).fill(y % 2 ? 0x55 : 0xaa)).flat()];
};

// Round 2 found: DC2 # n is a no-op (n prints as text), solid rows print nothing or only patches, a checker
// pattern (half the dots) prints fully. Round 3 (--round 3) looks for the largest dot coverage per row that prints.
const fill = (widthPx, heightPx, byteAt) => {
    const rowBytes = widthPx / 8;
    return [0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, heightPx & 0xff, heightPx >> 8,
        ...Array.from({ length: heightPx }, (_, y) => Array.from({ length: rowBytes }, (_, x) => byteAt(x, y))).flat()];
};

// Round 3 found: black dots per row are limited. 192 of 384 contiguous dots print solid black, above that the
// print fades (240 faint, 288 very faint, 336 almost nothing, 384 nothing). Round 4 (--round 4) tries ESC 7 n
// with its single parameter (maybe dots fired at once) on full-width black, plus coarse 50% chunk patterns.
// Round 4 found: ESC 7 n changes nothing and 8 / 24 dot 50% chunk patterns print dark. Round 5 (--round 5)
// narrows down the limit between 192 (solid) and 240 (streaky) dots with contiguous solid bars.
// Round 5 found: contiguous bars of 192 to 208 dots print solid, 216 gets specks, 224 to 240 are mottled.
// Round 6 (--round 6) sends the same kind of bars one raster row at a time with a pause after every row.
if (round === 6) {
    add([0x1b, 0x40, ...text("HEAT TEST 6, slowed rows"), ...feed(1)]);
    for (const pause of [150, 400]) {
        for (const dots of [216, 240, 264, 288]) {
            add(text(`${dots} dots, ${pause} ms per row`));
            for (let row = 0; row < 24; row++) {
                add(fill(384, 1, (x) => (x * 8 < dots ? 0xff : 0x00)), pause);
            }
            add(feed(1), 500);
        }
    }
    add([...text("done"), ...feed(4)]);
} else if (round === 5) {
    add([0x1b, 0x40, ...text("HEAT TEST 5, bar width in dots"), ...feed(1)]);
    for (const dots of [192, 200, 208, 216, 224, 232, 240]) {
        add([...text(`${dots} dots`), ...fill(384, 24, (x) => (x * 8 < dots ? 0xff : 0x00)), ...feed(1)], 1000);
    }
    add([...text("done"), ...feed(4)]);
} else if (round === 4) {
    add([0x1b, 0x40, ...text("HEAT TEST 4, ESC 7 n"), ...feed(1)]);
    for (const n of [0, 1, 2, 4]) {
        add([...ESC7(n, 0, 0).slice(0, 3), ...text(`S ESC 7 ${n}, full black`), ...fill(384, 32, () => 0xff), ...feed(2)], 1500);
    }
    add([...text("Q 8 dot chunks, 50%"), ...fill(384, 32, (x, y) => (((x + (y >> 2)) % 2) ? 0xff : 0x00)), ...feed(2)], 1200);
    add([...text("R 24 dot chunks, 50%"), ...fill(384, 32, (x, y) => ((((x / 3) | 0) + (y / 6 | 0)) % 2 ? 0xff : 0x00)), ...feed(2)], 1200);
    add([...ESC7(7, 0, 0).slice(0, 3), ...text("done"), ...feed(4)]);
} else if (round === 3) {
    add([0x1b, 0x40, ...text("HEAT TEST 3, coverage"), ...feed(1)]);
    const ladder = [
        ["K 4 of 8 dots (50%)", (x, y) => (y % 2 ? 0x55 : 0xaa)],
        ["L 5 of 8 dots (62%)", (x, y) => (y % 2 ? 0xb6 : 0x6d)],
        ["M 6 of 8 dots (75%)", (x, y) => (y % 2 ? 0xbb : 0xee)],
        ["N 7 of 8 dots (88%)", (x, y) => (y % 2 ? 0x7f : 0xf7)],
        ["O 8 of 8 dots (100%)", () => 0xff],
        ["P left half 100%, right half empty", (x) => (x < 24 ? 0xff : 0x00)],
    ];
    for (const [label, byteAt] of ladder) {
        add([...text(label), ...fill(384, 32, byteAt), ...feed(2)], 1200);
    }
    add([...text("done"), ...feed(4)]);
} else if (round === 1) {
    add([0x1b, 0x40, ...text("HEAT TEST, 5 blocks"), ...feed(1)]);
    for (const { label, cmd } of variants) {
        add([...cmd, ...text(label), ...block(384, 64), ...feed(2)]);
    }
    add([...ESC7(7, 80, 2), ...DC2_HASH(14), ...text("done"), ...feed(4)]);
} else {
    add([0x1b, 0x40, ...text("HEAT TEST 2"), ...feed(1)]);
    add([...DC2_HASH(31), ...text("F density 31"), ...block(384, 64), ...feed(2)], 1500);
    add([...DC2_HASH(0x5f), ...text("G density 31 break 2"), ...block(384, 64), ...feed(2)], 1500);
    add([...DC2_HASH(14), ...text("H strips 8 rows pause 600ms")]);
    for (let i = 0; i < 8; i++) {
        add(block(384, 8), 600);
    }
    add(feed(2), 1500);
    add([...text("I checker half load"), ...checker(384, 64), ...feed(2)], 1500);
    add([...text("J short block 16 rows"), ...block(384, 16), ...feed(2)], 1500);
    add([...text("done"), ...feed(4)]);
}
const bytes = Uint8Array.from(segments.flatMap((segment) => [...segment.bytes]));

if (dryFile) {
    fs.writeFileSync(dryFile, bytes);
    console.error(`wrote ${bytes.length} bytes to ${dryFile}`);
    process.exit(0);
}

const usb = createRequire(import.meta.url)("usb");
const device = usb.findByIds(vid, pid);
if (!device) {
    console.error(`printer ${vid.toString(16)}:${pid.toString(16)} not found`);
    process.exit(1);
}
device.open();
try {
    const iface = device.interfaces[0];
    if (iface.isKernelDriverActive()) {
        iface.detachKernelDriver();
    }
    iface.claim();
    const out = iface.endpoints.find((e) => e.direction === "out");
    for (const { bytes: chunk, pauseMs } of segments) {
        for (let offset = 0; offset < chunk.length; offset += 4096) {
            await new Promise((resolve, reject) => out.transfer(Buffer.from(chunk.subarray(offset, offset + 4096)),
                (error) => (error ? reject(error) : resolve())));
        }
        if (pauseMs) {
            await new Promise((resolve) => setTimeout(resolve, pauseMs));
        }
    }
    await new Promise((resolve) => iface.release(true, () => resolve()));
    console.error(`sent ${bytes.length} bytes`);
} finally {
    device.close();
}
