import { DiscoveryKey, ContactId, IContact } from './types';
import AutomergeWebsocketSync from './AutomergeWebsocketSync';
import Dexie from 'dexie';
import Automerge from 'automerge';
import { EventEmitter } from 'events';
import debug from 'debug';
import { v4 as uuid } from 'uuid';
import * as crypto from './crypto';

type DocumentId = string;

interface SavedBinary {
  id: string;
  binary: Automerge.BinaryDocument;
}

interface Backchannel {
  messages: Automerge.List<string>;
}

interface System {
  contacts: Automerge.List<IContact>;
}

function createRootDoc<T>(changeFn: Automerge.ChangeFn<T>): Automerge.Doc<T> {
  return Automerge.load(
    Automerge.getLastLocalChange(
      Automerge.change(Automerge.init('0000'), { time: 0 }, changeFn)
    )
  );
}

class IndexedDatabase extends Dexie {
  documents: Dexie.Table<SavedBinary, ContactId>;

  constructor(dbname) {
    super(dbname);
    this.version(1).stores({
      documents: 'id',
    });
    this.documents = this.table('documents');
  }
}

const SYSTEM_ID = 'BACKCHANNEL_backchannel';

export class Database extends EventEmitter {
  _idb: IndexedDatabase;
  _backchannel: AutomergeWebsocketSync<System>;
  _messages: Map<DocumentId, AutomergeWebsocketSync<Backchannel>>;

  opened: boolean;
  log: debug;

  constructor(dbname) {
    super();
    this._idb = new IndexedDatabase(dbname);
    this.open().then(() => {
      this.opened = true;
      this.log('open');
      this.emit('open');
    });
    this.log = debug('bc:db');
    this._messages = new Map<DocumentId, AutomergeWebsocketSync<Backchannel>>();
  }

  /**
   * Is this contact currently connected to us? i.e., currently online and we
   * have an open websocket connection with them
   * @param {ContactId} contactId
   * @return {boolean} connected
   */
  isConnected(contactId: ContactId): boolean {
    let contact = this.getContactById(contactId);
    let docId = contact.discoveryKey;
    let doc = this._messages.get(docId);
    return doc && !!doc.socket;
  }

  connected(contact: IContact, socket: WebSocket) {
    // Start encrypted protocol
    let syncer, documentId;
    if (contact.device) {
      documentId = SYSTEM_ID;
      syncer = this._backchannel;
      this.log('is a device');
    } else {
      documentId = contact.discoveryKey;
      syncer = this._messages[documentId];
      this.log('is a contact');
    }
    this.log('adding peer');
    syncer.addPeer(contact.id, socket);
    syncer.on('patch', (patch) => {
      this.emit('patch');
    });
    syncer.on('sync', () => {
      this.log('sync', documentId);
      this.emit('sync', contact.discoveryKey);
    });
    this.log('connected', contact.discoveryKey);
  }

  disconnected(documentId) {
    this.log('disconnected', documentId);
    this._messages[documentId].socket = null;
  }

  error(err) {
    this.log('got error', err);
    throw new Error(err);
  }

  getContacts(): IContact[] {
    return this._backchannel.doc.contacts;
  }

  getDocument(contact: IContact) {
    return this._messages[contact.discoveryKey];
  }

  change(docId: DocumentId, changeFn: Automerge.ChangeFn<unknown>) {
    this.log('changing', docId);
    let syncer = this._messages[docId];
    if (!syncer)
      this.error(new Error('Document doesnt exist with id ' + docId));
    syncer.change(changeFn);
  }

  async open() {
    if (this.opened) return;
    let system = await this._idb.documents
      .where({ id: SYSTEM_ID })
      .limit(1)
      .toArray();
    if (system.length) {
      // LOAD EXISTING DOCUMENTS
      let c = 0;
      let systemDoc: Automerge.Doc<System> = Automerge.load(system[0].binary);
      this._backchannel = new AutomergeWebsocketSync<System>(systemDoc);
      await this._idb.documents.each(async (_doc) => {
        if (_doc.id !== SYSTEM_ID) {
          c++;
          let doc: Automerge.Doc<Backchannel> = Automerge.load(_doc.binary);
          let contact = this.getContactByDiscoveryKey(_doc.id);
          let syncer = new AutomergeWebsocketSync<Backchannel>(doc);
          this._messages[contact.discoveryKey] = syncer;
        }
      });
      this.log(`loaded ${c} existing docs`);
      this.log('got contacts:', this._backchannel.doc.contacts);
      return;
    } else {
      // NEW DOCUMENT!
      let doc: Automerge.Doc<System> = createRootDoc<System>((doc: System) => {
        doc.contacts = [];
      });
      this._backchannel = new AutomergeWebsocketSync<System>(doc);
      await this._save(SYSTEM_ID, this._backchannel.doc);
      this.log('new contact list:', this._backchannel.doc.contacts);
      return;
    }
  }

  /**
   * Add a contact.
   */
  addContact(contact: IContact): ContactId {
    let id = uuid();
    contact.discoveryKey = crypto.computeDiscoveryKey(
      Buffer.from(contact.key, 'hex')
    );
    this._changeContactList((doc: System) => {
      contact.id = id;
      doc.contacts.push(contact);
    });

    let docId = contact.discoveryKey;
    let doc = createRootDoc<Backchannel>((doc: Backchannel) => {
      doc.messages = [];
    });
    this._messages[docId] = new AutomergeWebsocketSync<Backchannel>(doc);
    this.log('addContact', contact);
    return id;
  }

  /**
   * Update an existing contact in the database. The contact object should have
   * an `id`. The only valid property you can change is the moniker.
   * @param {IContact} contact - The contact to update to the database
   */
  editMoniker(id: ContactId, moniker: string) {
    this._changeContactList((doc: System) => {
      let contacts = doc.contacts.filter((c) => c.id === id);
      if (!contacts.length)
        this.error(new Error('Could not find contact with id' + id));
      contacts[0].moniker = moniker;
    });
  }

  addMessage(msg: string, docId: DocumentId) {
    this.change(docId, (doc: Backchannel) => {
      doc.messages.push(msg);
    });
  }

  getMessagesByContactId(cid: ContactId): string[] {
    let contact = this.getContactById(cid);
    return this.getMessages(contact.discoveryKey);
  }

  getMessages(id: DocumentId): string[] {
    return this._messages[id].doc.messages;
  }

  getContactById(id: ContactId): IContact {
    let contacts = this._backchannel.doc.contacts.filter((c) => c.id === id);
    if (!contacts.length) this.error(new Error('No contact with id ' + id));
    return contacts[0];
  }

  /**
   * Get contact by discovery key
   * @param {string} discoveryKey - the discovery key for this contact
   */
  getContactByDiscoveryKey(discoveryKey: string): IContact {
    let contacts = this._backchannel.doc.contacts.filter(
      (c) => c.discoveryKey === discoveryKey
    );
    if (!contacts.length) {
      this.error(
        new Error(
          'No contact with that document? that shouldnt be possible. Maybe you cleared your cache...'
        )
      );
    }

    return contacts[0];
  }

  async save() {
    let c = 0;
    for (let d in this._messages) {
      await this._save(d);
      c++;
    }
    await this._save(SYSTEM_ID, this._backchannel.doc);
    this.log(`saved ${c} documents`);
  }

  async destroy() {
    let tasks = [];
    this._messages.forEach((_, docId) => {
      tasks.push(this._idb.documents.delete(docId));
    });
    this.log('destroying', tasks.length);
    this.opened = false;
    return Promise.all(tasks);
  }

  _changeContactList(changeFn: Automerge.ChangeFn<unknown>) {
    this._backchannel.change(changeFn);
  }

  async _save(id: DocumentId, _doc?: Automerge.Doc<System>): Promise<string> {
    let doc = _doc || this._messages[id].doc;
    return this._idb.documents.put({
      id,
      binary: Automerge.save(doc),
    });
  }
}
