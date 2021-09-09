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

export type FileMetadata = {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  lastModified?: number;
};

export type PendingFile = {
  contactId: string;
  meta: FileMetadata;
  file: File;
};

export type FileProgress = {
  contactId: string;
  id: string;
  progress: number;
  offset: number;
  data?: Uint8Array;
  size: number;
};

export type SendFn = (msg: Uint8Array) => void;

export interface IContact {
  id?: ContactId;
  name?: string;
  avatar?: string; // -> stringified image representing this contact
  discoveryKey?: DiscoveryKey; // -> hash of code
  key: Key; // -> shared secret key I've accepted with them
  isConnected?: boolean;
  device: number;
}

export interface IDevice extends IContact {
  device: 1;
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

export enum CodeType {
  WORDS = 'words',
  NUMBERS = 'numbers',
}
