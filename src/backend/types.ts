import { symmetric, EncryptedProtocolMessage } from './crypto';

export type MessageId = string;
export type ContactId = string;
export type Code = string;
export type Key = string;
export type DiscoveryKey = string;

export interface IContact {
  id?: ContactId;
  moniker?: string;
  discoveryKey?: DiscoveryKey; // -> hash of code
  key: Key; // -> shared secret key I've accepted with them
  device: number;
}

export class IMessage {
  id?: MessageId;
  target: ContactId;
  incoming?: boolean;
  timestamp: string;
  text?: string;
  filename?: string;
  mime_type?: string;

  static encode(msg: IMessage, key: Key): string {
    let buf_key = Buffer.from(key, 'hex');
    let encoded = symmetric.encrypt(buf_key, JSON.stringify(msg));
    return JSON.stringify(encoded);
  }

  static decode(json: string, key: Key): IMessage {
    let buf_key = Buffer.from(key, 'hex');
    let decoded: EncryptedProtocolMessage = JSON.parse(json);
    return JSON.parse(symmetric.decrypt(buf_key, decoded));
  }
}
