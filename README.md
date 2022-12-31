# ESC/POS Client-Side Generator & Printer

Inspired by [snd](https://github.com/BigJk/snd) I thought it should be possible without requiring a server-side, making the whole experience faster and more convenient.
This repo contains a few components:

- Browser EscPosGenerator
    - Queue semantic commands which can be compiled to ESC/POS binary on demand
- NodeJS EscPosGenerator
    - Extends browser's EscPosGenerator to support printing from NodeJS as well 
- React/MUI SPA (hosted at [esc.pos.mtib.dev](https://esc.pos.mtib.dev/))
    - Completely static (no server) client-side app to template, layout and print using WebUSB
    - Note: [WebUSB](https://caniuse.com/webusb) isn't supported everywhere! This project targets only modern Chrome
- CLI Application to send data to a USB printer identified by vendor and product id

The EscPosGenerator is not aiming to be a fully featured ESC/POS encoder.
But supports initialisation, printing of formatted text as well as printing arbitrary image data.
If that is all you are trying to do, it might be one of the better ESC/POS encoders out there.

## Development

The project uses `npm` and `parcel`.

```sh
npm install # install dependencies (may require Cairo on MacOS)
npm run test # run test suite
npm run serve # get the SPA running with HMR
npm run build # build all projects
npm run deploy # build SPA and deploy to esc.pos.mtib.dev
```

## See also

- Sales & Dungeons: https://github.com/BigJk/snd inspiration for this project, requires large server-side and headless chromium
- Portable ESC/POS encoder: https://github.com/liuwm91/EscPosEncoder (with some bugs)
