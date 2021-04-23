import Dexie from 'dexie';
import blake from 'blake2b';
import { arrayToHex } from 'enc-utils';

export type ContactId = number;
export type Key = string;
export type DiscoveryKey = string;

export interface IContact {
  id?: ContactId;
  moniker?: string;
  discoveryKey?: DiscoveryKey; // -> hash of code
  key: Key; // -> code I've accepted with them
}

export interface IMessage {
  id?: number;
  incoming: boolean; // -> incoming or outgoing message
  timestamp: string;
  contact: number; // -> Contact.id
  text?: string;
  filename?: string;
  mime_type?: string;
}

export class Database extends Dexie {
  contacts: Dexie.Table<IContact, number>;
  messages: Dexie.Table<IMessage, number>;

  constructor(dbname) {
    super(dbname);

    this.version(1).stores({
      contacts: 'id++,moniker,&discoveryKey,key',
      messages: 'id++,incoming,text,contact,filename,mime_type',
    });

    // this is just so typescript understands what is going on
    this.contacts = this.table('contacts');
    this.messages = this.table('messages');
  }
}
