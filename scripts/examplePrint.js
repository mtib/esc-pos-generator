const NodeEscPosGenerator = require('../dist/index-node').default;

const gen = new NodeEscPosGenerator();

gen
    .writeLine('Hello world')
    .writeLine('Hello world')
    .writeLine('Hello world')
    .feedLine(4)
    .printData([0x0456, 0x0808]);
