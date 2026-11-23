# esc-pos-generator

Client-side ESC/POS encoder and printer tooling (no server). See README.md for the pitch.

## Layout

- `src/Command.ts`: command classes (`Raw`, `Initialize`, `Newline`, `Characters`, `RawImage`), each with `toBuffer()`.
- `src/EscPosGenerator.ts`: queues commands, `compile()` concatenates them into a `Uint8Array`. Browser safe.
- `src/NodeEscPosGenerator.ts`: adds USB printing in Node via the `usb` package.
- `src/cli.ts`: `<vid_hex>:<pid_hex> [file]`, sends a raw ESC/POS file or stdin to a printer.
- `src/spa/`: React app (no UI framework). Markdown is rendered to a DOM node, rasterised with dom-to-image-more,
  Atkinson-dithered and sent as one `RawImage` over WebUSB (Chrome only).
  - `src/spa/ui/`: the small DIY component library (`index.tsx`) and its dark theme (`ui.css`, CSS custom
    properties on `:root`). Built on native elements: label, input type=range, radio groups, details, dialog.
    Only `html`, `body` and box-sizing are styled globally; everything else is class scoped.
  - `src/spa/receipt.css`: styles of the rasterised `.receipt` node. These are printed pixels: any change here
    changes the output. `letter-spacing: 0.15008px` and `color-scheme: normal` pin what the old MUI baseline
    used to inherit, keep them. Never style plain elements under `.spa-preview` in `spa.css`, they would leak in.
  - `src/spa/components/SPA.tsx`: the page. `rasterise()` (dom-to-image, grayscale, Atkinson) feeds both the
    printer and the "printed result" canvas drawn over the HTML preview. On narrow screens the paper is scaled
    with a transform on an outer wrapper; the `.receipt` node itself must stay unscaled, rasterising reads its layout.
  - `src/spa/preset.ts`: settings ranges and defaults, plus the URL hash codec (tests in `preset.test.ts`).
  - `src/spa/examples.ts`: the default content and the example presets (checklist, `TEA_LABEL`).
  - `src/spa/sanitize.ts`: marked plus DOMPurify (pinned exact version); keeps inline styles, images and
    task list checkboxes, drops every other input.
  - `src/spa/errors.ts`, `format.ts`, `images.ts`: friendly WebUSB and render errors, file names and mm maths,
    pasted image downscaling and the localStorage quota check.
- `assets/`: files copied into the SPA build by `npm run deploy` (CNAME for esc.pos.mtib.dev).

## URL hash presets

`https://esc.pos.mtib.dev/#<hash>` where `<hash>` is base64url (padding optional) of a UTF-8 JSON object:

```json
{ "content": "# Markdown", "widthPx": 384, "padLeftPx": 5, "padRightPx": 5, "padBottomPx": 25, "fontSizePx": 16, "lineHeight": 1.2 }
```

All keys are optional, unknown keys are ignored, numbers are clamped and snapped to `RANGES` in `preset.ts`,
malformed hashes are ignored. On load a valid preset overrides the saved state (with Undo), then the hash is
removed with `history.replaceState` so a reload keeps the user's edits. "Copy link" builds the same format.

## Persistence gotcha

react-use-storage-state overwrites the saved value whenever the default passed to it changes, so changing
`DEFAULT_CONTENT` or `DEFAULT_SETTINGS` resets every user's saved content or settings. It also swallows quota
errors; `isSavedInLocalStorage` checks after the fact (used for pasted images).

## Commands

```sh
npm install
npx jest              # tests (ts-jest, src/**/*.test.ts)
npx tsc --noEmit      # type check, keep it clean
npm start             # SPA dev server with HMR
npm run build         # parcel build of all four targets
npm run deploy        # build + publish dist/target-spa to gh-pages
```

## Printer limits (0456:0808, measured with scripts/heat-test.mjs)

The 58 mm printer on AC power cannot fire more than about half the dots of a row: contiguous bars of 192, 200 and
208 black dots print solid, 216 gets specks, 224 to 240 are mottled, scattered patterns degrade sooner (62% coverage
is streaky), 288 dots are very faint, 336 almost invisible, 384 (a full row) print nothing. `ESC 7 n` (one
parameter, the three parameter heating form prints its extra bytes as text) and `DC2 # n` (a no-op, `n` prints as
text) change nothing, and pausing between strips does not help. Coarse 50% chunk patterns print dark.
`src/limitBlack.ts` therefore caps black dots per row at 54% of the width (207 dots) (thinning solid interiors in 8x4 dot chunks,
keeping outlines and a 2 dot margin around white text); the SPA applies it before preview and print behind the
"Limit black per row" switch (default on). Consequences: full-width rules print as short dashes, inverted (white on
black) text is unreadable, so design with outlines instead of black fills.
`scripts/heat-test.mjs [--round 1..5]` reprints the experiments (needs the printer free of the `usblp` driver).

## Preset links CLI

`scripts/esc-link.mjs [file] [--width px ...]` turns HTML/Markdown from a file or stdin into an esc.pos.mtib.dev
preset link (`--decode` inspects one, `--open` opens it in the browser instead of printing it, `--preview out.png` renders the dithered result headless
with Chromium and writes a PNG, `--print` sends exactly those pixels to the USB printer from Node). It imports `src/spa/preset.ts` directly (Node 22.18+), so it shares the app's
codec and clamping. The global skill `esc-pos-link` documents the workflow for Claude.

## CI and deploy

`.github/workflows/ci.yml` runs on GitHub-hosted runners (the repo is public, so never self-hosted ones):
type check and tests on every push and PR, and on pushes to main it builds the SPA and force-pushes it to the
`gh-pages` branch (served at esc.pos.mtib.dev, CNAME comes from `assets/target-spa`). `npm run deploy` does the same by hand.

## Conventions and gotchas

- 4 space indentation, double quotes in the library, strict TypeScript.
- Text is encoded as cp437 (printer default code page). Italics are accepted but ESC/POS has no italics.
- `RawImage` takes greyscale pixels row by row and pads each row to a whole byte; any width works.
  The SPA uses the dithered R channel and the preview element's `scrollWidth` x `scrollHeight`.
- WebUSB printing picks the first bulk OUT endpoint of the device instead of hardcoding one.
- Keep the library (`Command.ts`, `EscPosGenerator.ts`) free of Node and DOM APIs; only
  `NodeEscPosGenerator.ts` and `cli.ts` may use Node.
- Machine note: on the M1 laptop run heavy commands (`npm install`, `parcel build`) with `taskset -c 4-7`.
