# ESC/POS Client-Side Generator & Printer

[![CI/CD](https://github.com/mtib/esc-pos-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/mtib/esc-pos-generator/actions/workflows/ci.yml)

A modern, fully client-side ESC/POS thermal printer library for browser and Node.js environments. Inspired by [snd](https://github.com/BigJk/snd), this project eliminates the need for server-side processing, making thermal printing faster and more convenient.

## Components

### 🌐 Browser Library (`EscPosGenerator`)
- Queue semantic commands that compile to ESC/POS binary on demand
- Fluent API for text formatting, line feeds, and image printing
- Comprehensive TypeScript support with full JSDoc documentation
- Optimized buffer compilation for minimal memory usage

### 🖥️ Node.js Library (`NodeEscPosGenerator`) 
- Extends browser functionality with direct USB printing capabilities
- Enhanced error handling and connection management
- Support for custom printer selection via vendor/product IDs

### ⚛️ React SPA (hosted at [esc.pos.mtib.dev](https://esc.pos.mtib.dev/))
- Completely static client-side app for visual receipt design
- Real-time preview with customizable layout settings
- WebUSB integration with printer selection and speed control
- Markdown support for rich text formatting
- Toast notifications for user feedback
- **Note**: Requires [WebUSB](https://caniuse.com/webusb) support (modern Chrome/Edge)

### 🖨️ CLI Application
- Send files or stdin data directly to USB thermal printers
- Improved error messages and user guidance
- Support for hexadecimal vendor:product ID format

## Features

### ✅ Supported
- **Text Printing**: Formatted text with bold, italic, and underline support
- **Image Printing**: Bitmap images with automatic dithering and threshold conversion
- **Layout Control**: Line feeds, spacing, and positioning
- **Multi-Platform**: Browser (WebUSB) and Node.js (USB library) support
- **Performance Optimized**: Efficient buffer compilation and memory usage
- **Speed Control**: Configurable print speed with batch processing and delays

### ⚠️ Limitations
This is not a fully-featured ESC/POS encoder but focuses on the most common use cases. If you need comprehensive ESC/POS command support, consider other libraries.

## Development

The project uses `npm` and `parcel` with a comprehensive test suite and modern TypeScript configuration.

### Quick Start
```sh
npm install          # Install dependencies (may require Cairo on macOS)
npm test             # Run comprehensive test suite (44+ tests)
npm start            # Start SPA development server with HMR
npm run build        # Build all targets (node, browser, CLI, SPA)
npm run clean        # Clean build artifacts
npm run deploy       # Build and deploy SPA to GitHub Pages
```

### Testing
- **44+ comprehensive tests** covering all core functionality
- **Mocked USB dependencies** for testing without hardware
- **Performance benchmarking** built into the SPA
- **CI/CD pipeline** with automated testing on push

### Code Quality
- **Full TypeScript support** with strict mode enabled
- **Comprehensive JSDoc documentation** for all public APIs
- **Performance optimizations** in buffer compilation and image processing
- **Modern async/await patterns** throughout the codebase

## Usage Examples

### Browser (WebUSB)
```javascript
import EscPosGenerator from 'esc-pos-gen/browser';

const generator = new EscPosGenerator({ charactersPerLine: 32 });
generator
  .writeLine('Receipt Header', { bold: true, underline: UNDERLINE_SINGLE })
  .writeLine('Item 1                    $5.99')
  .writeLine('Item 2                    $3.50')
  .feedLine(2);

const binaryData = generator.compile();
// Send to printer via WebUSB
```

### Node.js (USB)
```javascript
import NodeEscPosGenerator from 'esc-pos-gen';

const generator = new NodeEscPosGenerator();
generator.writeLine('Hello from Node.js!');

// Print to USB printer (vendor:product ID)
await generator.printData([0x04b8, 0x0202]);
```

### CLI
```bash
# Print file
npx esc-pos-gen 04b8:0202 receipt.txt

# Print from stdin
echo "Hello World" | npx esc-pos-gen 04b8:0202
```

## Recent Improvements

- 🔧 **Updated dependencies** and fixed security vulnerabilities
- 📝 **Comprehensive JSDoc documentation** for all APIs
- ⚡ **Performance optimizations** in buffer compilation and image processing
- 🧪 **Extensive test suite** with 44+ tests and 100% core functionality coverage
- 🖨️ **Configurable print speed** with batch processing and delays
- 🎛️ **Enhanced SPA** with printer selection, endpoint configuration, and toast notifications
- 🔒 **Improved error handling** and connection management
- 🚀 **CI/CD pipeline** with automated testing and deployment

## See Also

- [Sales & Dungeons](https://github.com/BigJk/snd) - Inspiration for this project (requires server-side setup)
- [EscPosEncoder](https://github.com/liuwm91/EscPosEncoder) - Alternative portable encoder
