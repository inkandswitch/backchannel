import { symmetric, EncryptedProtocolMessage } from './crypto';
import { Backchannel as bc } from './backchannel';

export type MessageId = string;
export type ContactId = string;
export type Code = string;
export type Key = string;
export type DiscoveryKey = string;
export type DocumentId = string;
export type Backchannel = bc;

export interface IContact {
  id?: ContactId;
  moniker?: string;
  discoveryKey?: DiscoveryKey; // -> hash of code
  key: Key; // -> shared secret key I've accepted with them
  device: number;
  isConnected?: boolean;
}

export class IMessage {
  id?: MessageId;
  target: ContactId;
  incoming?: boolean;
  timestamp: string;
  text?: string;
  filename?: string;
  mime_type?: string;
}
