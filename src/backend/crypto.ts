import { Key, DiscoveryKey } from './types';

export type EncryptedProtocolMessage = {
  cipher: string;
  nonce: string;
};

export async function generateKey(): Promise<Key> {
  let rawKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
  return exportKey(rawKey)
}

export async function exportKey(key: CryptoKey): Promise<Key> {
  let raw: ArrayBuffer = await window.crypto.subtle.exportKey(
    'raw',
    key
  );
  return Buffer.from(raw).toString('hex')
}

export function importKey(key: Key | Buffer): Promise<CryptoKey> {
  if (typeof key === 'string') key = Buffer.from(key, 'hex')
  return window.crypto.subtle.importKey(
    'raw',
    key,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt']
  );
}

export const symmetric = {
  encrypt: async function (
    key: Key,
    msg: string
  ): Promise<EncryptedProtocolMessage> {
    let cryptoKey = await importKey(key)
    let enc = new TextEncoder();
    let plainText = enc.encode(msg);
    let iv = window.crypto.getRandomValues(new Uint8Array(12));
    let ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      plainText
    );

    return {
      cipher: Buffer.from(ciphertext).toString('hex'),
      nonce: Buffer.from(iv).toString('hex'),
    };
  },
  decrypt: async function (
    key: Key,
    msg: EncryptedProtocolMessage
  ): Promise<string> {
    let cryptoKey = await importKey(key)
    let decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: Buffer.from(msg.nonce, 'hex'),
      },
      cryptoKey,
      Buffer.from(msg.cipher, 'hex')
    );

    let dec = new TextDecoder();
    return dec.decode(decrypted);
  },
};

export async function computeDiscoveryKey(key: Key): Promise<DiscoveryKey> {
  let buf = Buffer.from(key, 'hex');
  let hash = await window.crypto.subtle.digest('SHA-256', buf);
  let disco = Buffer.from(hash).toString('hex');
  return disco;
}
