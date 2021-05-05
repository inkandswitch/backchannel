import Dexie from 'dexie';
import { ContactId, IContact, IMessage } from './types';

class IndexedDatabase extends Dexie {
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

export class Database {
  _db: IndexedDatabase;

  constructor(dbname) {
    this._db = new IndexedDatabase(dbname);
    // TODO: catch this error upstream and inform the user properly
    this._db.open().catch((err) => {
      console.error(`Database open failed : ${err.stack}`);
    });
  }

  addContact(contact: IContact) {
    return this._db.contacts.add(contact);
  }

  /**
   * Update an existing contact in the database.
   * The contact object should have an `id`
   * @param {IContact} contact - The contact to update to the database
   */
  updateContact(contact: IContact): Promise<ContactId> {
    return this._db.contacts.put(contact);
  }

  addMessage(msg: IMessage) {
    return this._db.messages.add(msg);
  }

  async getMessagesByContactId(cid: ContactId): Promise<IMessage[]> {
    return this._db.messages.where('contact').equals(cid).toArray();
  }

  async getContactById(id: ContactId): Promise<IContact> {
    let contacts = await this._db.contacts.where('id').equals(id).toArray();
    if (!contacts.length) {
      throw new Error('No contact with id');
    }
    return contacts[0];
  }

  /**
   * Get contact by discovery key
   * @param {string} discoveryKey - the discovery key for this contact
   */
  async getContactByDiscoveryKey(discoveryKey: string): Promise<IContact> {
    let contacts = await this._db.contacts
      .where('discoveryKey')
      .equals(discoveryKey)
      .toArray();
    if (!contacts.length) {
      throw new Error(
        'No contact with that document? that shouldnt be possible. Maybe you cleared your cache...'
      );
    }

    return contacts[0];
  }

  async listContacts(): Promise<IContact[]> {
    return await this._db.contacts.toArray();
  }

  destroy() {
    return this._db.delete();
  }
}
