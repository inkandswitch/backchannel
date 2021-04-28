
const path = require('path').join(__dirname, 'spake2_wasm_bg.wasm');
const bytes = require('fs').readFileSync(path);
let imports = {};
imports['./spake2_wasm.js'] = require('./spake2_wasm.js');

const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
module.exports = wasmInstance.exports;
