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
    used to inherit, keep them.
- `assets/`: files copied into the SPA build by `npm run deploy` (CNAME for esc.pos.mtib.dev).

## Commands

```sh
npm install
npx jest              # tests (ts-jest, src/*.test.ts)
npx tsc --noEmit      # type check, keep it clean
npm start             # SPA dev server with HMR
npm run build         # parcel build of all four targets
npm run deploy        # build + publish dist/target-spa to gh-pages
```

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
