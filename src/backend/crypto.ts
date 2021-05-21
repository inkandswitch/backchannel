import { arrayToHex } from 'enc-utils';
import { DiscoveryKey } from './types';

export type EncryptedProtocolMessage = {
  cipher: Buffer;
  nonce: Buffer;
};

export function generateKey () : Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export const symmetric = {
  encrypt: async function (key: CryptoKey, msg: string): Promise<EncryptedProtocolMessage> {
    let enc = new TextEncoder();
    let plainText = enc.encode(msg);
    let iv = window.crypto.getRandomValues(new Uint8Array(12));
    let ciphertext = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      plainText
    );

    return {
      cipher: Buffer.from(ciphertext),
      nonce: Buffer.from(iv)
    };
  },
  decrypt: async function (key: CryptoKey, msg: EncryptedProtocolMessage): Promise<string> {
    let decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: msg.nonce 
      },
      key,
      msg.cipher 
    );

    let dec = new TextDecoder();
    return dec.decode(decrypted);
  },
};

export async function computeDiscoveryKey(key: CryptoKey): Promise<DiscoveryKey> {
  let buf = await window.crypto.subtle.exportKey('raw', key)
  let hash = await window.crypto.subtle.digest('SHA-256', buf)
  return Buffer.from(hash).toString('hex')
}
