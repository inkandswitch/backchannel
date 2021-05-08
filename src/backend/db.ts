import { DiscoveryKey, Key, ContactId, IContact, IMessage } from './types';
import Dexie from 'dexie';
import Automerge from 'automerge';
import AutomergeWebsocketSync from './multidevice';
import { EventEmitter } from 'events';
import debug from 'debug';
import { v4 as uuid } from 'uuid';

type ActorId = string;
type DeviceId = Key;

interface Actor {
  id: ActorId;
  messages: Automerge.BinaryDocument;
  contacts: Automerge.BinaryDocument;
}

interface MessagesList {
  list: Automerge.List<IMessage>;
}

interface ContactList {
  list: Automerge.List<IContact>;
}

export interface Device {
  key: DeviceId;
  discoveryKey: DiscoveryKey;
  description: string;
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
  _contacts: Automerge.Doc<ContactList>;
  _messages: Automerge.Doc<MessagesList>;
  _idb: IndexedDatabase;
  opened: boolean;
  log: debug;
  _syncers: Map<ContactId, Automerge.SyncState>;

  constructor(dbname) {
    super();
    this._idb = new IndexedDatabase(dbname);
    this.open().then(() => {
      this.opened = true;
      this.emit('open');
    });
    this.log = debug('bc:db');
    this._syncers = new Map<ContactId, Automerge.SyncState>();
  }

  get devices() {
    return this._contacts.list.filter((c) => c.mine === 1);
  }

  async save() {
    await this._idb.actors.put({
      id: Automerge.getActorId(this._messages),
      messages: Automerge.save(this._messages),
      contacts: Automerge.save(this._contacts),
    });
  }

  disconnected(contact) {
    this._syncers = null;
  }

  connected(contact: IContact, socket: WebSocket) {
    let doc;
    if (contact.mine) {
      doc = this._contacts;
    } else {
      doc = this._messages;
    }
    this.log('connected', contact);
    this._syncers[contact.id] = new AutomergeWebsocketSync<typeof doc>(
      doc,
      socket
    );
  }

  async sync(contact: IContact) {
    let manager = this._syncers[contact.id];
    if (!manager) {
      this.log('no sockets available, not syncing with ', contact.id);
      return false;
    }
    this.log('syncing', contact.id);
    let patch = await manager.sync(Buffer.from(contact.key, 'hex'));
    this.emit('patch', patch);
  }

  async open() {
    if (this.opened) return;
    let actor = await this._getActor();
    if (actor) {
      // LOAD EXISTING DOCUMENT
      this._messages = Automerge.load(actor.messages, actor.id);
      this._contacts = Automerge.load(actor.contacts, actor.id);
      this.log('loading existing doc', actor.id);
    } else {
      // NEW DOCUMENT!
      this._messages = Automerge.init();
      let actor_id = Automerge.getActorId(this._messages);
      this._contacts = Automerge.init(actor_id);
      this.log('new doc', actor_id);

      this._idb.actors.add({
        id: actor_id,
        messages: Automerge.save(this._messages),
        contacts: Automerge.save(this._contacts),
      });

      this._contacts = Automerge.change(this._contacts, (doc) => {
        doc.list = [];
      });

      this._messages = Automerge.change(this._messages, (doc) => {
        doc.list = [];
      });
    }
  }

  /**
   * Add a contact.
   * TODO: Automatically broadcast to my devices that I've added a contact and
   * start the sync.
   */
  addContact(contact: IContact): ContactId {
    let id = uuid();
    this._contacts = Automerge.change(this._contacts, (doc: ContactList) => {
      contact.id = id;
      doc.list.push(contact);
    });
    return id;
  }

  /**
   * Update an existing contact in the database. The contact object should have
   * an `id`. The only valid property you can change is the moniker.
   * @param {IContact} contact - The contact to update to the database
   */
  editMoniker(id: ContactId, moniker: string) {
    this._contacts = Automerge.change(this._contacts, (doc: ContactList) => {
      let contacts = doc.list.filter((c) => c.id === id);
      if (!contacts.length) {
        throw new Error('Could not find contact with id' + id);
      }
      contacts[0].moniker = moniker;
    });
  }

  addMessage(msg: IMessage): IMessage {
    let id = uuid();
    this._messages = Automerge.change(this._messages, (doc: MessagesList) => {
      msg.id = id;
      doc.list.push(msg);
    });
    msg.id = id;
    let contact = this.getContactById(msg.contact);
    this.sync(contact);
    return msg;
  }

  getMessagesByContactId(cid: ContactId): IMessage[] {
    return this._messages.list.filter((m) => cid === m.contact);
  }

  getContactById(id: ContactId): IContact {
    let contacts = this._contacts.list.filter((c) => c.id === id);
    if (!contacts.length) {
      throw new Error('No contact with id ' + id);
    }
    return contacts[0];
  }

  /**
   * Get contact by discovery key
   * @param {string} discoveryKey - the discovery key for this contact
   */
  getContactByDiscoveryKey(discoveryKey: string): IContact {
    let contacts = this._contacts.list.filter(
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
    return this._contacts.list;
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
    } else {
      throw new Error(
        'Nothing to destroy@!!! actor doesnt exist with id=' + actor
      );
    }

    this._contacts = null;
    this._messages = null;
    this.opened = false;
  }
}
