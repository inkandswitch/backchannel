import { Client } from '@localfirst/relay-client';
import { randomBytes } from 'crypto';
import createHash from 'create-hash';
import * as bip from 'bip39';
import debug from 'debug';
import { serialize, deserialize } from 'bson';
import { symmetric, EncryptedProtocolMessage } from './crypto';
import english from './wordlist_en.json';

export type Code = {
  nameplate: string;
  password: string;
};

let VERSION = 1;
let appid = 'backchannel/app/mailbox/v1';
function lpad(str, padString, length) {
  while (str.length < length) {
    str = padString + str;
  }
  return str;
}
function bytesToBinary(bytes) {
  return bytes.map((x) => lpad(x.toString(2), '0', 8)).join('');
}
function deriveChecksumBits(entropyBuffer) {
  const ENT = entropyBuffer.length * 8;
  const CS = ENT / 32;
  const hash = createHash('sha256').update(entropyBuffer).digest();
  return bytesToBinary(Array.from(hash)).slice(0, CS);
}

function binaryToByte(bin) {
  return parseInt(bin, 2);
}

export class Wormhole {
  client: Client;
  log: debug;

  constructor(client) {
    this.client = client;
    this.log = debug('bc:wormhole');
  }

  async getNumericCode(): Promise<Code> {
    // this is an experimental feature
    // this is copied code from the bip library
    // we generate the same indexes that are used in the
    // word-based code, but don't convert them to words. instead just
    // return the indexes.
    let entropy = randomBytes(32);
    const entropyBits = bytesToBinary(Array.from(entropy));
    const checksumBits = deriveChecksumBits(entropy);
    const bits = entropyBits + checksumBits;
    const chunks = bits.match(/(.{1,11})/g);
    const code = chunks.map((binary) => {
      const index = binaryToByte(binary) % 999;
      if (index < 10) return `00${index}`;
      if (index < 100) return `0${index}`;
      return index;
    });
    let parts = code.slice(0, 3);
    return {
      nameplate: parts[0],
      password: parts[1] + '' + parts[2],
    };
  }

  async getCode(lang?: string): Promise<Code> {
    if (lang) {
      bip.setDefaultWordlist(lang);
    }
    let passwordPieces = bip
      .entropyToMnemonic(randomBytes(32), english)
      .split(' ');
    let parts = passwordPieces.filter((p) => p !== '').slice(0, 3);
    if (parts.length < 3) return this.getCode(lang);
    else
      return {
        nameplate: parts[0],
        password: parts[1] + ' ' + parts[2],
      };
  }

  leave(nameplate: string) {
    this.client.leave(nameplate);
  }

  async accept(nameplate: string, password: string): Promise<string> {
    if (nameplate.length === 0 || password.length === 0) return Promise.reject(new Error('Nameplate and password are required.'))
    return new Promise((resolve, reject) => {
      let listener = onPeerConnect.bind(this);
      this.log('joining', nameplate);
      this.client.join(nameplate).on('peer.connect', listener);

      function onPeerConnect({ socket, documentId }) {
        this.log('onPeerConnect', documentId);
        if (documentId === nameplate) {
          let spake2State = window.spake2.start(appid, password);
          let outbound = window.spake2.msg(spake2State);
          let outboundString = Buffer.from(outbound).toString('hex');

          socket.binaryType = 'arraybuffer';
          socket.send(outboundString);
          let key: string = null;

          let onmessage = async (e) => {
            let msg = e.data;
            if (!key) {
              let inbound = Buffer.from(msg, 'hex');
              let array: Uint8Array = window.spake2.finish(
                spake2State,
                inbound
              );
              key = Buffer.from(array).toString('hex');
              let encryptedMessage: EncryptedProtocolMessage = await symmetric.encrypt(
                key,
                JSON.stringify({ version: VERSION })
              );
              socket.send(serialize(encryptedMessage));
            } else {
              let decoded = deserialize(msg) as EncryptedProtocolMessage;
              try {
                let plainText = await symmetric.decrypt(key, decoded);
                let json = JSON.parse(plainText);
                this.log('got version', json.version);
                if (json.version !== VERSION) {
                  reject(
                    new Error(
                      'Secure connection established, but you or your contact are using an outdated version of Backchannel and need to upgrade.'
                    )
                  );
                } else {
                  resolve(key);
                }
              } catch (err) {
                this.log('error', err);
                reject(err);
              } finally {
                socket.removeEventListener('peer.connect', listener);
                socket.removeEventListener('message', onmessage);
                this.leave(nameplate);
                socket.close();
              }
            }
          };
          socket.addEventListener('message', onmessage);
        }
      }
    });
  }
}
