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
  mine: number; // > is this my device?
}

export class IMessage {
  id?: MessageId;
  incoming: boolean; // -> incoming or outgoing message
  timestamp: string;
  contact?: ContactId;
  text?: string;
  filename?: string;
  mime_type?: string;

  static encode(msg: IMessage, key: Key): string {
    let buf_key = Buffer.from(key, 'hex');
    let encoded = symmetric.encrypt(buf_key, msg.text);
    return JSON.stringify(encoded);
  }

  static decode(json: string, key: Key): IMessage {
    let buf_key = Buffer.from(key, 'hex');
    let decoded: EncryptedProtocolMessage = JSON.parse(json);
    let plainText = symmetric.decrypt(buf_key, decoded);
    return {
      text: plainText,
      timestamp: Date.now().toString(),
      incoming: true,
    };
  }
}
