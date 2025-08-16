# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an ESC/POS (receipt printer) client-side generator and printer that works in both browser and Node.js environments. It allows generating and printing thermal printer commands without requiring a server-side component.

## Build and Development Commands

```bash
npm install          # Install dependencies (may require Cairo on macOS)
npm run test         # Run Jest test suite
npm start            # Serve SPA with HMR on localhost
npm run build        # Build all targets (node, browser, CLI, SPA)
npm run clean        # Remove dist/ directory
npm run deploy       # Build and deploy SPA to GitHub Pages
```

## Architecture

The project has a multi-target build setup using Parcel:

### Core Components

- **EscPosGenerator** (`src/EscPosGenerator.ts`): Base class that builds ESC/POS commands as a queue of Command objects. Provides methods like `writeChars()`, `writeLine()`, `feedLine()` and `compile()` to generate binary data.

- **NodeEscPosGenerator** (`src/NodeEscPosGenerator.ts`): Extends the base generator with USB printing capabilities via the `usb` library. Includes static `print()` method and instance `printData()` method.

- **Command system** (`src/Command.ts`): Abstract Command class with implementations for Initialize, Raw, Newline, Characters, and RawImage. Commands convert to binary ESC/POS data via `toBuffer()`.

### Build Targets

- **target-node**: Library for Node.js (exports NodeEscPosGenerator)
- **target-browser**: Library for browsers (exports base EscPosGenerator)  
- **target-cli**: CLI application for printing files via USB
- **target-spa**: React SPA for visual printer template design
- **types**: TypeScript declarations

### SPA Architecture

The React SPA (`src/spa/`) uses:
- Material-UI for components and theming
- React Context for state management (`SPAContext`)
- `dom-to-image-more` for DOM-to-canvas conversion
- `canvas-dither` for image dithering
- Local storage state management via `react-use-storage-state`

The SPA allows users to design print layouts visually, then converts them to ESC/POS commands for WebUSB printing.

## Key Concepts

- **Command Pattern**: All printer operations are Commands that can be queued and compiled to binary
- **Multi-environment**: Same core logic works in browser (WebUSB) and Node.js (USB library)
- **Image Processing**: Supports converting DOM elements to dithered monochrome images for thermal printing
- **USB Printing**: Direct USB communication with thermal printers using vendor/product IDs

## Testing

Tests use Jest with ts-jest preset. Run individual tests with:
```bash
npm test -- --testNamePattern="test name"
```