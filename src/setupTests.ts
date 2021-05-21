// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { Crypto } from "@peculiar/webcrypto"
import { TextDecoder, TextEncoder } from 'web-encoding';

global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder
global.crypto = new Crypto()