import { Client } from '@localfirst/relay-client';
import { randomBytes } from 'crypto';
import * as bip from 'bip39';
import debug from 'debug';
import { serialize, deserialize } from 'bson';
import { symmetric, EncryptedProtocolMessage } from './crypto';

let VERSION = 1
let appid = 'backchannel/app/mailbox/v1';

export class Wormhole {
  client: Client;
  log: debug;

  constructor(client) {
    this.client = client;
    this.log = debug('bc:wormhole');
  }

  getCode(lang?: string) {
    if (lang) bip.setDefaultWordlist(lang);
    let passwordPieces = bip.entropyToMnemonic(randomBytes(32)).split(' ');
    let password = passwordPieces.filter((p) => p !== '').slice(0, 3);
    if (password.length < 3) return this.getCode(lang);
    else return password.join('-');
  }

  async _symmetric(code: string): Promise<Uint8Array> {
    let parts = code.split('-');
    let nameplate = parts.shift();
    let password = parts.join('-');
    return new Promise((resolve, reject) => {
      let discoveryKey = `wormhole-${nameplate}`;
      this.log('joining', discoveryKey);
      this.client.join(discoveryKey).on('peer.connect', onPeerConnect.bind(this));

      function onPeerConnect({ socket, documentId }) {
        this.log('onPeerConnect', documentId);
        if (documentId === discoveryKey) {
          let spake2State = window.spake2.start(appid, password);
          let outbound = window.spake2.msg(spake2State);
          let outboundString = Buffer.from(outbound).toString('hex');

          socket.binaryType = 'arraybuffer';
          socket.send(outboundString);
          let key = null

          let onmessage = (e) => {
            let msg = e.data
            if (!key) {
              let inbound = Buffer.from(msg, 'hex');
              key: Uint8Array = window.spake2.finish(spake2State, inbound);
              let encryptedMessage = symmetric.encrypt(
                key, JSON.stringify({ 'version': VERSION })
              )
              socket.send(serialize(encryptedMessage))
            } else {
              let decoded = deserialize(msg) as EncryptedProtocolMessage
              try {
                let versionStr = JSON.parse(symmetric.decrypt(key, decoded))
                if (versionStr !== VERSION) {
                  reject(new Error('Secure connection established, but you or your contact are using an outdated version of Backchannel and need to upgrade.'))
                }
                resolve(key);
              } catch (err) {
                this.log('error', err)
                reject(new Error('Secure connection failed. Did you type the code in correctly? Try again.'))
              } finally {
                socket.removeAllListeners()
                this.client.leave(discoveryKey)
                socket.close()
              }
            }
          }
          socket.addEventListener('message', onmessage)
        }
      }
    });
  }

  async announce(code) {
    return this._symmetric(code);
  }

  async accept(code) {
    return this._symmetric(code);
  }
}
