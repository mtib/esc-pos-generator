const usb = require('usb');
const { bmRequestType, DIRECTION, TYPE, RECIPIENT } = require('bmrequesttype');
const fs = require('node:fs/promises');
const { LIBUSB_TRANSFER_TYPE_BULK } = require('usb/dist/usb');
const EscPosGenerator = require('../dist/index-node').default;

const gen = new EscPosGenerator();

gen
    .writeLine('Hello world')
    .writeLine('Hello world')
    .writeLine('Hello world')
    .feedLine(4);

const buffer = gen.compile();

console.log(buffer);

const filename = './exampleFile.raw';

(async () => {
    await fs.writeFile(filename, buffer);
    const readBuffer = Uint8Array.from(await fs.readFile(filename));

    console.log(readBuffer);
})();
