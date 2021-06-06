import { Backchannel as bc } from './backchannel';

export enum MessageType {
  FILE = 'file',
  TEXT = 'text',
  TOMBSTONE = 'tombstone',
  ACK = 'ack',
}
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

export interface IMessage {
  id?: MessageId;
  type: MessageType;
  target: ContactId;
  timestamp: string;
  incoming?: boolean;
}

export interface TextMessage extends IMessage {
  text?: string;
}

export enum FileState {
  QUEUED = 0,
  ERROR = 1,
  SUCCESS = 2,
  PROGRESS = 3,
}

export interface FileMessage extends IMessage {
  size: number;
  name: string;
  mime_type?: string;
  lastModified: number;
  state: FileState;
}
