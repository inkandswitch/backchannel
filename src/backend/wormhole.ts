import { Client } from '@localfirst/relay-client';
import { randomBytes } from 'crypto';
import * as bip from 'bip39';
import debug from 'debug';
import { serialize, deserialize } from 'bson';
import { symmetric, EncryptedProtocolMessage } from './crypto';

export type Code = {
  nameplate: string;
  password: string;
};

let VERSION = 1;
let appid = 'backchannel/app/mailbox/v1';
let PREFIX = 'wormhole-';

export class Wormhole {
  client: Client;
  log: debug;
  wordlist: string[];

  constructor(client: Client, wordlist: string[]) {
    this.client = client;
    this.wordlist = wordlist;
    this.log = debug('bc:wormhole');
  }

  async getCode(passwordPieces = []): Promise<Code> {
    let nextPieces = bip
      .entropyToMnemonic(randomBytes(32), this.wordlist)
      .split(' ');
    passwordPieces = passwordPieces.concat(
      nextPieces.find((piece) => piece != '')
    );
    if (passwordPieces.length < 3) return this.getCode(passwordPieces);
    else
      return {
        nameplate: passwordPieces[0],
        password: passwordPieces[1] + ' ' + passwordPieces[2],
      };
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
