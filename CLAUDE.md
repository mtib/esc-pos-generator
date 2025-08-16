# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an ESC/POS (receipt printer) client-side generator and printer that works in both browser and Node.js environments. It allows generating and printing thermal printer commands without requiring a server-side component.

## Build and Development Commands

```bash
npm install          # Install dependencies (may require Cairo on macOS)
npm test             # Run comprehensive Jest test suite (44+ tests)
npm start            # Serve SPA with HMR on localhost
npm run build        # Build all targets (node, browser, CLI, SPA)
npm run clean        # Remove dist/ directory
npm run deploy       # Build and deploy SPA to GitHub Pages
```

## Testing
- Comprehensive test suite with 44+ tests covering all core functionality
- Mocked USB dependencies for testing without hardware requirements
- Performance benchmarking built into the SPA
- Run specific tests: `npm test -- --testNamePattern="test name"`

## Architecture

The project has a multi-target build setup using Parcel:

### Core Components

- **EscPosGenerator** (`src/EscPosGenerator.ts`): Base class with fluent API for building ESC/POS command queues. Optimized buffer compilation and comprehensive JSDoc documentation. Methods: `writeChars()`, `writeLine()`, `feedLine()`, `compile()`.

- **NodeEscPosGenerator** (`src/NodeEscPosGenerator.ts`): Extends base generator with enhanced USB printing. Improved error handling, connection management, and proper resource cleanup. Uses `usb` library for direct hardware communication.

- **Command system** (`src/Command.ts`): Abstract Command pattern with implementations for Initialize, Raw, Newline, Characters, and RawImage. All classes have comprehensive documentation and performance optimizations.

### Build Targets

- **target-node**: Library for Node.js (exports NodeEscPosGenerator)
- **target-browser**: Library for browsers (exports base EscPosGenerator)  
- **target-cli**: CLI application for printing files via USB
- **target-spa**: React SPA for visual printer template design
- **types**: TypeScript declarations

### SPA Architecture & UI Layout

The React SPA (`src/spa/`) features a two-panel layout optimized for thermal printer design:

**UI Layout Design:**
- **Left Panel (Controls)**: Grows horizontally (`flexGrow: 1`) to use available space since thermal receipts have small fixed widths
- **Right Panel (Preview)**: Fixed width based on printer width setting (`widthPx + 80px`) with minimum of 400px
- **Layout Rationale**: Receipt content is narrow (typically 384px), so controls should expand to fill remaining space for better usability

**Technical Features:**
- **Material-UI** with custom dark theme, gradient backgrounds, and card-based organization
- **React Context** for efficient state management (`SPAContext`)
- **Toast notifications** via `react-hot-toast` for comprehensive user feedback
- **Optimized image processing** with `dom-to-image-more` and `canvas-dither`
- **Persistent settings** via `react-use-storage-state`
- **WebUSB printing** with hardcoded endpoint 3 for reliable communication
- **Independent scrolling** for both panels with proper overflow handling

**Key UI Improvements:**
- Grouped controls into logical cards (Printer Settings, Spacing, Typography, Actions)
- Connection status indicators with visual chips
- Enhanced toast notifications with processing time feedback
- Professional styling with elevation, borders, and rounded corners

## Key Concepts

- **Command Pattern**: All printer operations are Commands with optimized `toBuffer()` methods
- **Performance Optimized**: Efficient buffer compilation, reduced memory allocations
- **Multi-environment**: Same core logic works in browser (WebUSB) and Node.js (USB library)
- **Enhanced Image Processing**: Optimized pixel conversion with configurable thresholds
- **Robust USB Communication**: Proper error handling, connection management, and resource cleanup
- **Modern TypeScript**: Strict mode enabled with comprehensive type safety

## Recent Improvements

### Code Quality
- Added comprehensive JSDoc documentation to all public APIs
- Implemented TypeScript strict mode with enhanced type safety
- Optimized buffer compilation algorithm for better performance
- Enhanced error handling throughout the codebase

### SPA Enhancements  
- Added printer selection with USB device filtering
- Implemented configurable print speed control
- Added toast notifications for better user experience
- Improved layout with independent scrolling areas
- Added top margin control for print layouts

### Testing & CI/CD
- Expanded test suite to 44+ comprehensive tests
- Added GitHub Actions CI/CD pipeline
- Automated testing and deployment on push to main
- Mock USB dependencies for hardware-independent testing

### Dependencies
- Updated all dependencies to latest secure versions
- Fixed critical security vulnerability in gh-pages
- Added react-hot-toast for user notifications