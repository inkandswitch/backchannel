import { ContactId, IContact, IMessage } from './types';
import Dexie from 'dexie';
import Automerge from 'automerge';
import { EventEmitter } from 'events';

type ActorId = string;

interface Actor {
  id: ActorId;
  automerge_doc: Automerge.BinaryDocument;
}

interface AutomergeDatabase {
  contacts: Automerge.Table<IContact>;
  messages: Automerge.Table<IMessage>;
}

class IndexedDatabase extends Dexie {
  actors: Dexie.Table<Actor, ActorId>; // ActorId = type of the primkey

  constructor(dbname) {
    super(dbname);
    this.version(1).stores({
      actors: 'id',
    });
    this.actors = this.table('actors');
  }
}

export class Database extends EventEmitter {
  _doc: Automerge.Doc<AutomergeDatabase>;
  _idb: IndexedDatabase;
  opened: boolean;

  constructor(dbname) {
    super();
    this._idb = new IndexedDatabase(dbname);
    this.open().then(() => {
      this.opened = true;
      this.emit('open');
    });
  }

  async save() {
    let id = await this._idb.actors.put({
      id: Automerge.getActorId(this._doc),
      automerge_doc: Automerge.save(this._doc),
    });
    return id;
  }

  async open() {
    if (this.opened) return;
    let actor = await this._getActor();
    if (actor) {
      // LOAD EXISTING DOCUMENT
      this._doc = Automerge.load(actor.automerge_doc, actor.id);
    } else {
      // NEW DOCUMENT!
      this._doc = Automerge.init();
      let actor_id = Automerge.getActorId(this._doc);
      this._idb.actors.add({
        id: actor_id,
        automerge_doc: Automerge.save(this._doc),
      });
      this._doc = Automerge.change(this._doc, (doc: AutomergeDatabase) => {
        doc.contacts = new Automerge.Table();
        doc.messages = new Automerge.Table();
      });
    }
  }

  addContact(contact: IContact): ContactId {
    let id;
    this._doc = Automerge.change(this._doc, (doc: AutomergeDatabase) => {
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
    this._doc = Automerge.change(this._doc, (doc: AutomergeDatabase) => {
      let contact = doc.contacts.byId(id);
      contact.moniker = moniker;
    });
    return this._doc.contacts.byId(id);
  }

  addMessage(msg: IMessage) {
    let id;
    this._doc = Automerge.change(this._doc, (doc: AutomergeDatabase) => {
      id = doc.messages.add(msg);
    });
    return id;
  }

  getMessagesByContactId(cid: ContactId): IMessage[] {
    return this._doc.messages.filter((m) => cid === m.contact);
  }

  getContactById(id: ContactId): IContact {
    let contact = this._doc.contacts.byId(id);
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
    let contacts = this._doc.contacts.filter(
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
    return this._doc.contacts.rows;
  }

  async _getActor(): Promise<Actor> {
    let actors = await this._idb.actors.limit(1).toArray();
    if (!actors.length) return null;
    return actors[0];
  }

  async destroy() {
    let actor = await this._getActor();
    if (actor) {
      await this._idb.actors.delete(actor.id);
    }
    this._doc = null;
    this.opened = false;
  }
}
