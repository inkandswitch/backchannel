// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
require('fake-indexeddb/auto');
let { Crypto } = require('@peculiar/webcrypto');
let { TextDecoder, TextEncoder } = require('web-encoding');

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
global.crypto = new Crypto();
