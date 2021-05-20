import { ContactId, IContact } from './types';
import AutomergeDiscovery from './AutomergeDiscovery';
import { DB } from './automerge-db';
import Automerge, { Frontend } from 'automerge';
import { EventEmitter } from 'events';
import debug from 'debug';
import { v4 as uuid } from 'uuid';
import * as crypto from './crypto';
import { Backend } from 'automerge';

type DocumentId = string;

interface System {
  contacts: Automerge.List<IContact>;
}

const SYSTEM_ID = 'BACKCHANNEL_ROOT_DOCUMENT';

export class Database<T> extends EventEmitter {
  private _idb: DB;
  private _syncers: Map<DocumentId, AutomergeDiscovery> = new Map<
    DocumentId,
    AutomergeDiscovery
  >();
  private _frontends: Map<DocumentId, Automerge.Doc<System | T>> = new Map<
    DocumentId,
    Automerge.Doc<System | T>
  >();
  private log: debug;

  private _opened: boolean;
  private _opening: boolean = false;

  /**
   * Create a new database for a given Automerge document type.
   *
   * @param {string} dbname The name of the database
   */
  constructor(dbname) {
    super();
    this._idb = new DB(dbname);
    this.log = debug('bc:db');
    this.open().then(() => {
      this._opened = true;
      this.log('open');
      this.emit('open');
    });
  }

  /**
   * Get an array of all document ids
   */
  get documents(): string[] {
    return Array.from(this._syncers.keys()).filter((d) => d !== SYSTEM_ID);
  }

  error(err) {
    this.log('got error', err);
    throw new Error(err);
  }

  set root(doc: Automerge.Doc<System>) {
    this._frontends.set(SYSTEM_ID, doc);
  }

  get root(): Automerge.Doc<System> {
    return this._frontends.get(SYSTEM_ID) as Automerge.Doc<System>;
  }

  private _hydrateContact(contact: IContact): IContact {
    let isConnected = this.isConnected(contact);
    return { ...contact, isConnected };
  }

  getContacts(): IContact[] {
    return this.root.contacts.map((c) => this._hydrateContact(c));
  }

  // FIXME this API is awkward yo
  onDeviceConnect(peerId: string, send: Function): Promise<Function> {
    let syncer = this._syncer(SYSTEM_ID);
    return this._addPeer(syncer, peerId, send);
  }

  onPeerConnect(
    docId: DocumentId,
    peerId: string,
    send: Function
  ): Promise<Function> {
    let doc = this._syncer(docId);
    return this._addPeer(doc, peerId, send);
  }

  private async _addPeer(
    syncer: AutomergeDiscovery,
    peerId: string,
    send: Function
  ) {
    let contact = this.getContactById(peerId);
    this.log('adding peer', contact);
    let docId = contact.discoveryKey;
    let state = await this._idb.getSyncState(docId, peerId);
    let peer = {
      id: peerId,
      send,
      state,
      key: Buffer.from(contact.key, 'hex'),
    };
    return syncer.addPeer(peerId, peer);
  }

  async onDisconnect(docId, peerId): Promise<void> {
    this.log('onDisconnect', docId)
    let doc = this._syncer(docId);
    if (!doc) doc = this._syncer(SYSTEM_ID)
    let peer = doc.getPeer(peerId);
    await this._idb.storeSyncState(docId, peerId, peer.state);
    doc.removePeer(peerId);
  }

  getDocument(docId: DocumentId): Automerge.Doc<System | T> {
    this.log('getting document', docId);
    let syncer = this._syncers.get(docId);
    if (!syncer) throw new Error('No doc for docId ' + docId);
    return this._frontends.get(docId);
  }

  /**
   * Is this contact currently connected to us? i.e., currently online and we
   * have an open websocket connection with them
   * @param {IContact} contact The contact object
   * @return {boolean} connected If the contact is currently connected
   */
  isConnected(contact: IContact): boolean {
    let docId;
    if (contact.device) {
      docId = SYSTEM_ID;
    } else {
      docId = contact.discoveryKey;
    }
    let doc = this._syncers.get(docId);
    if (!doc) return false;
    return doc.hasPeer(contact.id);
  }

  /**
   * Get the document for this contact.
   * @param {ContactId} contactId
   * @returns Automerge document
   */
  getDocumentByContactId(contactId: ContactId): Automerge.Doc<System | T> {
    let contact = this.getContactById(contactId);
    let docId = contact.discoveryKey;
    return this.getDocument(docId);
  }

  addDocument(
    contactId: ContactId,
    changeFn: Automerge.ChangeFn<T>
  ): Promise<string> {
    let contact = this.getContactById(contactId);
    return this._addDocument(contact.discoveryKey, changeFn);
  }

  async _loadDocument(docId): Promise<string> {
    let doc = await this._idb.getDoc(docId);
    let state = doc.serializedDoc
      ? Backend.load(doc.serializedDoc)
      : Backend.init();

    this.log('loading document', doc.changes);
    const [backend, patch] = Backend.applyChanges(state, doc.changes);
    let frontend: Automerge.Doc<T | System> = Automerge.Frontend.applyPatch(
      Frontend.init(),
      patch
    );
    this.log('got doc', frontend, backend);
    return this._hyrateDocument(docId, frontend, backend);
  }

  async change(docId: DocumentId, changeFn: Automerge.ChangeFn<System | T>) {
    this.log('changing', docId);
    let doc = this._frontends.get(docId);
    const [newDoc, changeData] = Automerge.Frontend.change(doc, changeFn);
    this._frontends.set(docId, newDoc);
    let syncer = this._syncer(docId);
    if (!syncer)
      this.error(new Error('Document doesnt exist with id ' + docId));
    let change = syncer.change(changeData);
    const decodedChange = Automerge.decodeChange(change);
    this.log('storing change', docId);
    await this._idb.storeChange(docId, (decodedChange as any).hash, change);
    syncer.updatePeers();
  }

  async _addDocument(
    docId: string,
    changeFn: Automerge.ChangeFn<T>
  ): Promise<string> {
    let doc = Automerge.change(Automerge.init('0000'), { time: 0 }, changeFn);
    let change = Automerge.Frontend.getLastLocalChange(doc);
    const decodedChange = Automerge.decodeChange(change);
    await this._idb.storeChange(docId, (decodedChange as any).hash, change);
    return this._loadDocument(docId);
  }

  async _hyrateDocument(
    docId: string,
    frontend: Automerge.Doc<T | System>,
    backend: Automerge.BackendState
  ) {
    this._frontends.set(docId, frontend);
    let syncer = new AutomergeDiscovery(docId, backend);
    this._syncers.set(docId, syncer);
    let doc = this._frontends.get(docId);

    syncer.on('patch', ({ docId, patch, change }) => {
      let frontend = this._frontends.get(docId);
      if (!frontend)
        throw new Error(
          `No frontend for docId ${docId} .. this should not be happening!`
        );

      let newFrontend = Automerge.Frontend.applyPatch(frontend, patch);
      this._frontends.set(docId, newFrontend);
      this.log('got patch', docId, 'updating frontend');
      this.emit('patch', docId);
    });
    this.log('document hydrated', docId, doc);
    return docId;
  }

  /**
   * Open the database. This is called automatically when you create the
   * instance and you don't need to call it.
   * @returns When the database has been opened
   */
  async open(): Promise<any[]> {
    this.log('opening', this._opening);
    if (this._opening)
      return new Promise((resolve) => {
        this.once('open', resolve);
      });
    this._opening = true;
    if (this._opened) return;
    await this._loadDocument(SYSTEM_ID);
    this.log('got contacts', this.root.contacts);
    if (this.root.contacts) {
      // LOAD EXISTING DOCUMENTS
      let c = 0;
      this.log('loading docs');
      let tasks = [];
      this.root.contacts.forEach(async (contact) => {
        c++;
        let docId = contact.discoveryKey;
        this.log('loading', docId);
        tasks.push(this._loadDocument(docId));
      });
      this.log(`loaded ${c} existing docs`);
      this.log('got contacts:', this.root.contacts);
      return Promise.all(tasks);
    } else {
      // NEW INSTANCE!
      this.log('new contact list. changing', SYSTEM_ID);
      //@ts-ignore
      await this._addDocument(SYSTEM_ID, (doc: System) => {
        doc.contacts = [];
      });
      return;
    }
  }

  addDevice(key: string, description: string): Promise<ContactId> {
    return this.addContact(key, description, 1);
  }

  /**
   * Add a contact.
   */
  async addContact(
    key: string,
    moniker: string,
    device?: number
  ): Promise<ContactId> {
    let id = uuid();
    let discoveryKey = crypto.computeDiscoveryKey(Buffer.from(key, 'hex'));
    let contact: IContact = {
      id,
      key,
      moniker,
      discoveryKey,
      device: device ? 1 : 0,
    };
    this.log('addContact', key, moniker);
    await this.change(SYSTEM_ID, (doc: System) => {
      doc.contacts.push(contact);
    });
    return id;
  }

  /**
   * Update an existing contact in the database. The contact object should have
   * an `id`. The only valid property you can change is the moniker.
   * @param {IContact} contact - The contact to update to the database
   */
  editMoniker(id: ContactId, moniker: string): Promise<void> {
    return this.change(SYSTEM_ID, (doc: System) => {
      let contacts = doc.contacts.filter((c) => c.id === id);
      if (!contacts.length)
        this.error(new Error('Could not find contact with id' + id));
      contacts[0].moniker = moniker;
    });
  }

  getContactById(id: ContactId): IContact {
    let contacts = this.root.contacts.filter((c) => c.id === id);
    if (!contacts.length) this.error(new Error('No contact with id ' + id));
    return this._hydrateContact(contacts[0]);
  }

  /**
   * Get contact by discovery key
   * @param {string} discoveryKey - the discovery key for this contact
   */
  getContactByDiscoveryKey(discoveryKey: string): IContact {
    let contacts = this.root.contacts.filter(
      (c) => c.discoveryKey === discoveryKey
    );
    if (!contacts.length) {
      this.error(
        new Error(
          'No contact with that document? that shouldnt be possible. Maybe you cleared your cache...'
        )
      );
    }

    return this._hydrateContact(contacts[0]);
  }

  async destroy() {
    this._opened = false;
    return this._idb.destroy();
  }

  _syncer(docId) {
    return this._syncers.get(docId);
  }

  createHeadDocument<T>(changeFn: Automerge.ChangeFn<T>): Automerge.Doc<T> {
    return;
  }
}
