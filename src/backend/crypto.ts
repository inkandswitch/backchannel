import { Key, DiscoveryKey } from './types';

export type EncryptedProtocolMessage = {
  cipher: ArrayBuffer;
  nonce: ArrayBuffer;
};

export async function generateKey () : Promise<Key> {
  let rawKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  )
  let exported = await window.crypto.subtle.exportKey('raw', rawKey);
  return Buffer.from(exported).toString('hex');
}

export function importKey(key: Key): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    Buffer.from(key, 'hex'),
    "AES-GCM",
    true,
    ['encrypt', 'decrypt']
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
      cipher: ciphertext,
      nonce: iv
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

export async function computeDiscoveryKey(key: Key): Promise<DiscoveryKey> {
  let buf = Buffer.from(key, 'hex')
  let hash = await window.crypto.subtle.digest('SHA-256', buf)
  let disco = Buffer.from(hash).toString('hex')
  return disco;
}
