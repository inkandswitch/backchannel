import Automerge from 'automerge';
import { EventEmitter } from 'events';
import debug from 'debug';
import { v4 as uuid } from 'uuid';
import { Backend } from 'automerge';

import * as crypto from './crypto';
import { Key, ContactId, IContact } from './types';
import AutomergeDiscovery from './AutomergeDiscovery';
import { DB } from './automerge-db';
import { ReceiveSyncMsg } from './AutomergeDiscovery';

type DocumentId = string;

export interface System {
  contacts: Automerge.List<IContact>;
  settings: any;
}

const SYSTEM_ID = 'BACKCHANNEL_ROOT_DOCUMENT';

export class Database<T> extends EventEmitter {
  public onContactListChange: Function;
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
  constructor(dbname: string, onContactListChange?: Function) {
    super();
    this.onContactListChange = onContactListChange;
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

  get settings(): any {
    return this.root.settings;
  }

  async changeRoot(changeFn: Automerge.ChangeFn<System>) {
    await this.change(SYSTEM_ID, changeFn);
  }

  set root(doc: Automerge.Doc<System>) {
    this._frontends.set(SYSTEM_ID, doc);
  }

  get root(): Automerge.Doc<System> {
    return this._frontends.get(SYSTEM_ID) as Automerge.Doc<System>;
  }

  async getBlob(id: string): Promise<Uint8Array> {
    let maybeBlob = await this._idb.blobs.get(id);
    if (maybeBlob) return maybeBlob.data;
    else return null;
  }

  saveBlob(id: string, data: Uint8Array) {
    return this._idb.blobs.put({ id, data }, id);
  }

  getContacts(): IContact[] {
    if (!this.root.contacts) return [];
    return this.root.contacts.map((c) => this._hydrateContact(c));
  }

  error(err) {
    this.log('got error', err);
    throw new Error(err);
  }
  /**
   * When a peer connects, call this function
   * @param contact The contact that connected
   * @param send A function for sending data
   * @returns A function to call when messages come in
   */
  onPeerConnect(
    peerId: string,
    contact: IContact,
    send: Function
  ): ReceiveSyncMsg {
    let docId: string = this.getDocumentId(contact);
    let syncer = this._syncer(docId);
    if (!syncer)
      throw new Error(
        'No syncer exists for this peer, this should never happen.'
      );
    this.log('adding peer', peerId);
    let peer = {
      id: peerId,
      send,
    };
    return syncer.addPeer(peerId, peer);
  }

  /**
   * When a peer disconnects, call this function
   * @param docId A unique identifer for the document
   * @param peerId A unique identifier for the peer (should be the same called in onPeerConnect)
   */
  async onDisconnect(docId, peerId): Promise<void> {
    this.log('onDisconnect', docId);
    let doc = this._syncer(docId);
    if (!doc) doc = this._syncer(SYSTEM_ID);
    let peer = doc.getPeer(peerId);
    if (!peer) return;
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
   * @return {boolean} If the contact is currently connected
   */
  isConnected(contact: IContact): boolean {
    let docId = this.getDocumentId(contact);
    let doc = this._syncers.get(docId);
    if (!doc) return false;
    let match = doc.peers.filter((p) => {
      return p.id.startsWith(contact.id);
    });
    return match.length > 0;
  }

  getDocumentId(contact: IContact): string {
    if (contact.device) {
      return SYSTEM_ID;
    } else {
      return contact.discoveryKey;
    }
  }

  /**
   * Make a change to a document.
   * @param docId The document ID
   * @param changeFn The Automerge change function to change the document.
   */
  async change(docId: DocumentId, changeFn: Automerge.ChangeFn<System | T>) {
    let doc = this._frontends.get(docId);
    const [newDoc, changeData] = Automerge.Frontend.change(doc, changeFn);
    this.log('changing', docId, changeData);
    this._frontends.set(docId, newDoc);
    let syncer = this._syncer(docId);
    if (!syncer)
      this.error(new Error('Document doesnt exist with id ' + docId));
    if (changeData) {
      let change = syncer.change(changeData);
      this.log('storing change', docId);
      await this._idb.storeChange(docId, change);
      syncer.updatePeers();
    }
  }

  async deleteContact(id: ContactId): Promise<void> {
    this.log('deleteContact', id);
    await this.change(SYSTEM_ID, (doc: System) => {
      let idx = doc.contacts.findIndex((c) => c.id === id);
      delete doc.contacts[idx];
    });
  }

  /**
   * Add a contact.
   */
  async addContact(
    key: Key,
    moniker: string,
    device?: number
  ): Promise<ContactId> {
    let id = uuid();
    let discoveryKey = await crypto.computeDiscoveryKey(key);
    let contact: IContact = {
      id,
      key,
      moniker,
      discoveryKey,
      device: device ? 1 : 0,
    };
    this.log('addContact', key, moniker, device);
    await this.change(SYSTEM_ID, (doc: System) => {
      doc.contacts.push(contact);
    });
    return id;
  }

  addDocument(
    contact: IContact,
    changeFn: Automerge.ChangeFn<T>
  ): Promise<DocumentId> {
    return this._addDocument(contact.discoveryKey, changeFn);
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
      this.log('loading contacts', this.root.contacts);
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
        doc.settings = {};
      });
      return;
    }
  }

  /**
   * Update an existing contact in the database. The contact object should have
   * an `id`. The only valid property you can change is the moniker.
   * @param {ContactId} id - The id of the contact to update
   * @param {string} moniker - The contact's new moniker
   */
  editMoniker(id: ContactId, moniker: string): Promise<void> {
    return this.change(SYSTEM_ID, (doc: System) => {
      let contacts = doc.contacts.filter((c) => c.id === id);
      if (!contacts.length)
        this.error(new Error('Could not find contact with id=' + id));
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

  async save(docId: DocumentId) {
    return this._idb.saveSnapshot(docId);
  }

  private _syncer(docId) {
    return this._syncers.get(docId);
  }

  private async _addDocument(
    docId: DocumentId,
    changeFn: Automerge.ChangeFn<T>
  ): Promise<DocumentId> {
    let doc = Automerge.change(Automerge.init('0000'), { time: 0 }, changeFn);
    let change = Automerge.Frontend.getLastLocalChange(doc);
    this.log('addDocument', docId);
    await this._idb.storeChange(docId, change);
    return this._loadDocument(docId);
  }

  private async _hyrateDocument(
    docId: string,
    frontend: Automerge.Doc<T | System>,
    backend: Automerge.BackendState
  ): Promise<DocumentId> {
    this._frontends.set(docId, frontend);
    let syncer = new AutomergeDiscovery(docId, backend);
    this._syncers.set(docId, syncer);
    let doc = this._frontends.get(docId);

    syncer.on('patch', ({ docId, patch, changes }) => {
      let frontend = this._frontends.get(docId);
      if (!frontend)
        throw new Error(
          `No frontend for docId ${docId} .. this should not be happening!`
        );

      let newFrontend = Automerge.Frontend.applyPatch(frontend, patch);
      changes.forEach(async (c) => {
        await this._idb.storeChange(docId, c);
      });
      this._frontends.set(docId, newFrontend);
      if (docId === SYSTEM_ID && this.onContactListChange)
        this.onContactListChange(patch);
      else this.emit('patch', { docId, patch });
    });
    this.log('Document hydrated', doc);
    return docId;
  }

  private async _loadDocument(docId: DocumentId): Promise<DocumentId> {
    this.log('loadDocument', docId);
    let doc = await this._idb.getDoc(docId);
    let state = doc.serializedDoc
      ? Backend.load(doc.serializedDoc)
      : Backend.init();

    const [backend, patch] = Backend.applyChanges(state, doc.changes);
    let frontend: Automerge.Doc<T | System> = Automerge.Frontend.applyPatch(
      Automerge.Frontend.init(),
      patch
    );
    return this._hyrateDocument(docId, frontend, backend);
  }

  private _hydrateContact(contact: IContact): IContact {
    let isConnected = this.isConnected(contact);
    return { ...contact, isConnected };
  }
}
