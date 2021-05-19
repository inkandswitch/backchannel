import { ContactId, IContact } from './types';
import AutomergeDiscovery from './AutomergeDiscovery';
import { DB } from './automerge-db';
import Automerge, { Doc, FreezeObject } from 'automerge';
import { EventEmitter } from 'events';
import debug from 'debug';
import { v4 as uuid } from 'uuid';
import * as crypto from './crypto';
import { Backend } from 'automerge';

type DocumentId = string;

interface SavedBinary {
  id: string;
  binary: Automerge.BinaryDocument;
  changes: Automerge.BinaryChange[]
}

interface System {
  contacts: Automerge.List<IContact>;
}

const SYSTEM_ID = 'BACKCHANNEL_ROOT_DOCUMENT';

export class Database<T> extends EventEmitter {
  private _idb: DB;
  private _syncers: Map<DocumentId, AutomergeDiscovery>;
  private _frontends: Map<DocumentId, Automerge.Doc<System | T>>;
  private log: debug;

  opened: boolean;

  /**
   * Create a new database for a given Automerge document type.
   *
   * @param {string} dbname The name of the database
   */
  constructor(dbname) {
    super();
    this._idb = new DB(dbname);
    this.open().then(() => {
      this.opened = true;
      this.log('open');
      this.emit('open');
    });
    this.log = debug('bc:db');
    this._syncers = new Map<DocumentId, AutomergeDiscovery>();
    this._frontends = new Map < DocumentId, Automerge.Doc <System | T>>();
  }

  /**
   * Get an array of all document ids
   */
  get documents(): string[] {
    return Array.from(this._syncers.keys());
  }

  error(err) {
    this.log('got error', err);
    throw new Error(err);
  }

  set root(doc: Automerge.Doc<System>) {
    this._frontends.set(SYSTEM_ID, doc)
  }

  get root() : Automerge.Doc<System> {
    return this._frontends.get(SYSTEM_ID) as Automerge.Doc<System>
  }

  private _hydrateContact(contact: IContact): IContact {
    let isConnected = this.isConnected(contact);
    return { ...contact, isConnected };
  }

  getContacts(): IContact[] {
    return this.root.contacts.map((c) => this._hydrateContact(c));
  }

  onDeviceConnect(peerId: string, send: Function): Function {
    let syncer = this._syncer(SYSTEM_ID)
    return this._addPeer(syncer, peerId, send);
  }

  private _addPeer(
    syncer: AutomergeDiscovery,
    peerId: string,
    send: Function
  ) {
    let contact = this.getContactById(peerId);
    this.log('adding peer', contact);
    let peer = {
      id: peerId,
      send,
      key: Buffer.from(contact.key, 'hex'),
    };
    return syncer.addPeer(peerId, peer);
  }

  onPeerConnect(docId: DocumentId, peerId: string, send: Function): Function {
    let doc = this._syncer(docId);
    return this._addPeer(doc, peerId, send);
  }

  onDisconnect(docId, peerId) {
    let doc = this._syncer(docId);
    if (doc) doc.removePeer(peerId);
    else this._syncer(SYSTEM_ID).removePeer(peerId);
  }

  getDocument(docId: DocumentId): Automerge.Doc<System | T> {
    this.log('getting document', docId);
    let syncer = this._syncers.get(docId);
    if (!syncer) throw new Error('No doc for docId ' + docId);
    return this._frontends.get(docId)
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
    this.log('isConnected', docId, contact.id);
    return doc && doc.hasPeer(contact.id);
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

  change(docId: DocumentId, changeFn: Automerge.ChangeFn<T>) {
    this.log('changing', docId);
    let doc = this._frontends.get(docId)
    const [newDoc, changeData] = Automerge.Frontend.change(doc, changeFn)
    let syncer = this._syncer(docId);
    if (!syncer)
      this.error(new Error('Document doesnt exist with id ' + docId));
    syncer.change(changeData);
  }

  private _createSyncer<J>(
    docId: DocumentId,
    backend: Automerge.BackendState,
  ): AutomergeDiscovery {

    let syncer = new AutomergeDiscovery(docId, backend);

    syncer.on('sync', (peerId) => {
      this.log('got sync', docId, peerId);
      this.emit('sync', { docId, peerId });
    });

    syncer.on('patch', ({ docId, patch, change }) => {
      let frontend = this._frontends.get(docId)
      if (!frontend) throw new Error(`No frontend for docId ${docId} .. this should not be happening!`)

      let newFrontend = Automerge.Frontend.applyPatch(frontend, patch)
      this._frontends.set(docId, newFrontend)
      const decodedChange = Automerge.decodeChange(change)
      this._idb.storeChange(docId, (decodedChange as any).hash, change)
    })

    return syncer;
  }

  async _loadDocument(docId) : Promise<[ Automerge.BackendState, Automerge.FreezeObject<J> ]> {
    let doc = await this._idb.getDoc(docId)
    if (!doc) return Promise.reject()
    const [backend, patch] = Backend.applyChanges(
      Backend.load(doc.serializedDoc),
      doc.changes,
    )
    let frontend: Automerge.Doc<T | System> = Automerge.Frontend.applyPatch(
      Automerge.Frontend.init(), patch
    )
    this._frontends.set(docId, frontend)
    let syncer = this._createSyncer(docId, backend);
    this._syncers.set(docId, syncer)
    return [backend, frontend]
  }

  /**
   * Open the database. This is called automatically when you create the
   * instance and you don't need to call it.
   * @returns When the database has been opened
   */
  async open(): Promise<void> {
    if (this.opened) return;
    try { 
      await this._loadDocument(SYSTEM_ID)

      // LOAD EXISTING DOCUMENTS
      let c = 0;
      this.log('loading docs')
      await this.root.contacts.forEach(async contact => {
        c++;
        let docId = contact.discoveryKey
        await this._loadDocument(docId)
      });
      this.log(`loaded ${c} existing docs`);
      this.log('got contacts:', this.root.contacts);
      return;
    } catch (err) {
      // NEW DOCUMENT!
      let frontend = this.createRootDoc<System>(
        (doc: System) => {
          doc.contacts = [];
        }
      );
      let backend = Automerge.Frontend.getBackendState(frontend)
      await this.addDocument(SYSTEM_ID, frontend, backend)
      this.log('new contact list:', this.root.contacts);
      return;
    }
  }

  addDevice(key: string, description: string): ContactId {
    return this.addContact(key, description, 1);
  }

  /**
   * Add a contact.
   */
  addContact(key: string, moniker: string, device?: number): ContactId {
    let id = uuid();
    let discoveryKey = crypto.computeDiscoveryKey(Buffer.from(key, 'hex'));
    let contact: IContact = {
      id,
      key,
      moniker,
      discoveryKey,
      device: device ? 1 : 0,
    };
    this.log('addContact', key, moniker)
    this._changeContactList((doc: System) => {
      doc.contacts.push(contact);
    });
    return id;
  }

  /**
   * Add a document to the database.
   * @param docId Unique documentid for this document
   * @param doc An automerge document
   */
  addDocument(docId: DocumentId, doc: Automerge.Doc<System | T>, backend: Automerge.BackendState): Promise<unknown> {
    let syncer: AutomergeDiscovery = this._createSyncer(docId, backend);
    this._frontends.set(docId, doc)
    this._syncers.set(docId, syncer);
    this.log('addDocument', docId, doc);
    return this._idb.saveSnapshot(docId);
  }

  /**
   * Update an existing contact in the database. The contact object should have
   * an `id`. The only valid property you can change is the moniker.
   * @param {IContact} contact - The contact to update to the database
   */
  editMoniker(id: ContactId, moniker: string) {
    return this._changeContactList((doc: System) => {
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
    this.opened = false;
    this._idb.destroy()
  }

  _changeContactList(changeFn: Automerge.ChangeFn<System>) {
    let [ newDoc, changeData ] = Automerge.Frontend.change(this.root, changeFn)
    this._syncers.get(SYSTEM_ID).change(changeData);
    this.root = newDoc
  }

  _syncer(docId) {
    return this._syncers.get(docId);
  }

  createHeadDocument<T>(
    changeFn: Automerge.ChangeFn<T>
  ): Automerge.Doc<T> {
    let doc = Automerge.change(Automerge.init('0000'), { time: 0 }, changeFn)
    return Automerge.load(
      // @ts-ignore
      Automerge.Frontend.getLastLocalChange(doc)
    )
  }

}
