import Dexie from 'dexie';

export type ContactId = number;

export interface IContact {
  id?: ContactId;
  moniker?: string;
  documents: Array<string>; // -> codes i've accepted with them
  public_key?: string;
}

export interface IMessage {
  id?: number;
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
      contacts: 'id++,moniker,*documents,public_key',
      messages: 'id++,text,contact,filename,mime_type',
    });

    // this is just so typescript understands what is going on
    this.contacts = this.table('contacts');
    this.messages = this.table('messages');
  }
}
