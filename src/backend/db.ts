import { ContactId, IContact, IMessage } from './types';
import Automerge from 'automerge';

interface AutomergeDatabase {
  contacts: Automerge.Table<IContact>;
  messages: Automerge.Table<IMessage>;
}

export class Database {
  _db: Automerge;

  constructor(dbname) {
    this._db = Automerge.change(Automerge.init(), (doc: AutomergeDatabase) => {
      doc.contacts = new Automerge.Table();
      doc.messages = new Automerge.Table();
    });
  }

  addContact(contact: IContact): ContactId {
    let id;
    this._db = Automerge.change(this._db, (doc: AutomergeDatabase) => {
      id = doc.contacts.add(contact);
    });
    return id;
  }

  /**
   * Update an existing contact in the database. The contact object should have
   * an `id`. The only valid property you can change is the moniker.
   * @param {IContact} contact - The contact to update to the database
   */
  async editMoniker(id: ContactId, moniker: string): Promise<IContact> {
    this._db = Automerge.change(this._db, (doc: AutomergeDatabase) => {
      let contact = doc.contacts.byId(id);
      contact.moniker = moniker;
    });
    return this._db.contacts.byId(id);
  }

  addMessage(msg: IMessage) {
    let id;
    this._db = Automerge.change(this._db, (doc: AutomergeDatabase) => {
      id = doc.messages.add(msg);
    });
    return id;
  }

  getMessagesByContactId(cid: ContactId): IMessage[] {
    return this._db.messages.filter((m) => cid === m.contact);
  }

  getContactById(id: ContactId): IContact {
    let contact = this._db.contacts.byId(id);
    if (!contact) {
      throw new Error('No contact with id ' + id);
    }
    return contact;
  }

  /**
   * Get contact by discovery key
   * @param {string} discoveryKey - the discovery key for this contact
   */
  getContactByDiscoveryKey(discoveryKey: string): IContact {
    let contacts = this._db.contacts.filter(
      (c) => c.discoveryKey === discoveryKey
    );
    if (!contacts.length) {
      throw new Error(
        'No contact with that document? that shouldnt be possible. Maybe you cleared your cache...'
      );
    }

    return contacts[0];
  }

  listContacts(): IContact[] {
    return this._db.contacts.rows;
  }

  destroy() {
    this._db = null;
  }
}
