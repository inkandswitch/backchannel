import { ContactId, IContact } from './types';
import AutomergeDiscovery from './AutomergeDiscovery';
import { DB } from './automerge-db';
import Automerge from 'automerge';
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
  private _syncers: Map<DocumentId, AutomergeDiscovery>;
  private _frontends: Map<DocumentId, Automerge.Doc<System | T>>;
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
    this._syncers = new Map<DocumentId, AutomergeDiscovery>();
    this._frontends = new Map <DocumentId, Automerge.Doc <System | T>>();
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
    return Array.from(this._syncers.keys()).filter(d => d !== SYSTEM_ID);
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
    if (!doc) return false
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

  async change(docId: DocumentId, changeFn: Automerge.ChangeFn<System | T>) {
    this.log('changing', docId);
    let doc = this._frontends.get(docId)
    const [newDoc, changeData] = Automerge.Frontend.change(doc, changeFn)
    this._frontends.set(docId, newDoc)
    let syncer = this._syncer(docId);
    if (!syncer)
      this.error(new Error('Document doesnt exist with id ' + docId));
    let change = syncer.change(changeData);
    const decodedChange = Automerge.decodeChange(change)
    await this._idb.storeChange(docId, (decodedChange as any).hash, change)
  }

  private _createSyncer(
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
    })

    return syncer;
  }

  async addDocument(docId) : Promise<[ Automerge.BackendState, Automerge.FreezeObject<T | System> ]> {
    let doc = await this._idb.getDoc(docId)
    this.log('loading doc', docId)
    const [backend, patch] = Backend.applyChanges(
      doc.serializedDoc ? Backend.load(doc.serializedDoc) : Backend.init(),
      doc.changes,
    )
    let frontend: Automerge.Doc<T | System> = Automerge.Frontend.applyPatch(
      Automerge.Frontend.init(), patch
    )
    this._frontends.set(docId, frontend)
    let syncer = this._createSyncer(docId, backend);
    this._syncers.set(docId, syncer)
    this.log('setting syncer and frontend', docId)
    return [backend, frontend]
  }

  /**
   * Open the database. This is called automatically when you create the
   * instance and you don't need to call it.
   * @returns When the database has been opened
   */
  async open(): Promise<any[]> {
    if (this._opening) return new Promise((resolve) => {
      this.once('open', resolve)
    })
    this._opening = true
    if (this._opened) return;
    await this.addDocument(SYSTEM_ID)
    if (this.root.contacts) {
      // LOAD EXISTING DOCUMENTS
      let c = 0;
      this.log('loading docs')
      let tasks = []
      this.root.contacts.forEach(async contact => {
        c++;
        let docId = contact.discoveryKey
        this.log('loading', docId)
        tasks.push(this.addDocument(docId))
      });
      this.log(`loaded ${c} existing docs`);
      this.log('got contacts:', this.root.contacts);
      return Promise.all(tasks);
    } else {
      // NEW DOCUMENT!
      this.log('new contact list. changing', SYSTEM_ID)
      await this.change(SYSTEM_ID, (doc: System) => {
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
  async addContact(key: string, moniker: string, device?: number): Promise<ContactId> {
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
  editMoniker(id: ContactId, moniker: string) : Promise<void> {
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
    this._idb.destroy()
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
