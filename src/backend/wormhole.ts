import { Client } from '@localfirst/relay-client';
import { randomBytes } from 'crypto';
import * as bip from 'bip39';
import debug from 'debug';

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
      let _docId = `wormhole-${nameplate}`;
      this.log('joining', _docId);
      this.client.join(_docId).on('peer.connect', onPeerConnect.bind(this));

      function onPeerConnect({ socket, documentId }) {
        this.log('onPeerConnect', documentId);
        if (documentId === _docId) {
          let spake2State = window.spake2.start(appid, password);
          let outbound = window.spake2.msg(spake2State);
          let outboundString = Buffer.from(outbound).toString('hex');
          socket.send(outboundString);

          socket.binaryType = 'arraybuffer';
          socket.addEventListener('message', (e) => {
            let msg = e.data;
            let inbound = Buffer.from(msg, 'hex');
            let key: Uint8Array = window.spake2.finish(spake2State, inbound);
            resolve(key);
          });
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
