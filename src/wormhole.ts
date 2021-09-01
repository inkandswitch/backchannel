import { Client } from '@localfirst/relay-client';
import debug from 'debug';
import { serialize, deserialize } from 'bson';
import { symmetric, EncryptedProtocolMessage } from './crypto';
import * as spake2 from 'spake2-wasm';

let VERSION = 1;
let appid = 'backchannel/app/mailbox/v1';
let PREFIX = 'wormhole-';

/*
type SPAKE = {
  start: (appid: string, password: string) => any,
  msg: (state: any) => Uint8Array,
  finish: (state: any, inbound: Buffer) => Uint8Array
}
*/

export class Wormhole {
  client: Client;
  log;

  constructor(client: Client) {
    this.client = client;
    this.log = debug('bc:wormhole');
  }

  join(nameplate: string) {
    return this.client.join(PREFIX + nameplate);
  }

  leave(nameplate: string) {
    this.client.leave(PREFIX + nameplate);
  }

  async accept(nameplate: string, password: string): Promise<string> {
    if (nameplate.length === 0 || password.length === 0)
      return Promise.reject(new Error('Nameplate and password are required.'));
    return new Promise((resolve, reject) => {
      let listener = onPeerConnect.bind(this);
      this.log('joining', nameplate);
      this.join(nameplate).on('peer.connect', listener);

      function onPeerConnect({ socket, documentId }) {
        this.log('onPeerConnect', documentId);
        if (documentId.replace(PREFIX, '') === nameplate) {
          //@ts-ignore
          let spake2State = spake2.start(appid, password);
          //@ts-ignore
          let outbound = spake2.msg(spake2State);
          let outboundString = Buffer.from(outbound).toString('hex');

          socket.binaryType = 'arraybuffer';
          socket.send(outboundString);
          let key: string = null;

          let onmessage = async (e) => {
            let msg = e.data;
            if (!key) {
              let inbound = Buffer.from(msg, 'hex');
          //@ts-ignore
              let array: Uint8Array = spake2.finish(spake2State, inbound);
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
