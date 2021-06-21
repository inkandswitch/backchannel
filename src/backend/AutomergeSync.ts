import {
  Frontend,
  ChangeFn,
  BinaryChange,
  Doc,
  BinarySyncMessage,
  Patch,
  Change,
  Backend,
  BackendState,
  SyncState,
} from 'automerge';
import debug from 'debug';
import { EventEmitter } from 'events';

type PeerId = string;

export type ReceiveSyncMsg = (msg: Uint8Array) => void;

interface Peer {
  id: string;
  send: Function;
  idle?: Boolean;
  state?: SyncState;
}

export default class AutomergeDiscovery extends EventEmitter {
  public doc: BackendState;
  public docId: string;
  private _peers: Map<PeerId, Peer>;
  private log: debug;

  constructor(docId: string, backend?: BackendState) {
    super();
    this.doc = backend || Backend.init();
    this.docId = docId;
    this._peers = new Map<PeerId, Peer>();
    this.log = debug('bc:AutomergePeers:' + this.docId.slice(0, 5));
  }

  removePeer(id): boolean {
    return this._peers.delete(id);
  }

  hasPeer(id): boolean {
    return this._peers.has(id);
  }

  get peers(): Peer[] {
    return Array.from(this._peers.values());
  }

  getPeer(id): Peer {
    return this._peers.get(id);
  }

  idle() {
    for (let peerId in this._peers) {
      let p = this._peers.get(peerId);
      if (!p.idle) return false;
    }
    return true;
  }

  _onmessage(peer) {
    return (msg: Uint8Array) => {
      msg = new Uint8Array(msg);
      this._receive(peer, msg as BinarySyncMessage);
    };
  }

  addPeer(id: string, peer: Peer): ReceiveSyncMsg {
    let exists = this._peers.get(id);
    if (exists) this.removePeer(id);
    this.log('adding peer', id);
    peer.state = Backend.initSyncState();
    this._peers.set(id, peer);

    // HELLO!
    this.log('sending hello');
    this._updatePeer(peer);
    return this._onmessage(peer);
  }

  change(change: Change): BinaryChange {
    // LOCAL CHANGE
    this.log('in change function');
    const [newBackend, patch, newChange] = Backend.applyLocalChange(
      this.doc,
      change
    );
    this._sendToRenderer(patch);
    this.doc = newBackend;
    this.updatePeers();
    return newChange;
  }

  updatePeers() {
    this.log('updating peers', this.docId, Array.from(this._peers).length);
    this._peers.forEach((peer) => {
      peer.idle = false;
      this._updatePeer(peer);
    });
  }

  _sendToRenderer(patch: Patch, changes: BinaryChange[] = []) {
    this.log('emitting patch');
    this.emit('patch', { docId: this.docId, patch, changes });
  }

  _updatePeer(peer) {
    this.log('updating peer', peer.id);
    let [nextSyncState, msg] = Backend.generateSyncMessage(
      this.doc,
      peer.state
    );
    peer.state = nextSyncState;
    this._peers.set(peer.id, peer);
    if (msg) {
      this.log('sending syncMsg len=', msg.length);
      peer.send(msg);
      return true;
    } else {
      return false;
    }
  }

  _receive(peer, syncMsg: BinarySyncMessage): Patch {
    this.log('got syncMsg len=', syncMsg.length);
    let oldDoc = this.doc;
    let [newDoc, newSyncState, patch] = Backend.receiveSyncMessage(
      this.doc,
      peer.state,
      syncMsg
    );
    this.doc = newDoc;
    peer.state = newSyncState;
    this._peers.set(peer.id, peer);
    if (patch) {
      let changes = Backend.getChanges(newDoc, Backend.getHeads(oldDoc));
      this._sendToRenderer(patch, changes);
    }
    this.updatePeers();
    return patch;
  }
}

type DocumentId = string;

export class MultipleDocuments {
  private _syncers: Map<DocumentId, AutomergeDiscovery> = new Map<
    DocumentId,
    AutomergeDiscovery
  >();
  private _frontends: Map<DocumentId, Doc<unknown>> = new Map<
    DocumentId,
    Doc<unknown>
  >();
  private log: debug;

  constructor() {
    this.log = debug('multipledocuments');
  }

  /**
   * Get an array of all document ids
   */
  get documents(): string[] {
    return Array.from(this._syncers.keys());
  }

  add(id: DocumentId, doc: Doc<unknown>) {
    this._frontends.set(id, doc);
  }

  get(docId) {
    let syncer = this._syncers.get(docId);
    if (!syncer) {
      this.log('error: no doc for docId' + docId);
      throw new Error('No doc for docId ' + docId);
    }
    return this._frontends.get(docId);
  }

  private _syncer(docId) {
    return this._syncers.get(docId);
  }

  destroy() {
    this._frontends.clear();
    this._syncers.clear();
  }

  error(err) {
    this.log('got error', err);
    throw new Error(err);
  }

  /**
   * When a peer connects, call this function
   * @param peerId
   * @param docId
   * @param send
   * @returns
   */
  onPeerConnect(docId: string, peerId: string, send: Function): ReceiveSyncMsg {
    let syncer = this._syncer(docId);
    if (!syncer) {
      throw new Error(
        `No syncer exists for this ${docId}, this should never happen.`
      );
    }
    this.log('adding peer', peerId);
    let peer = {
      id: peerId,
      send,
    };
    return syncer.addPeer(peerId, peer);
  }

  onPeerDisconnect(docId: DocumentId, peerId: string) {
    let doc = this._syncer(docId);
    if (!doc) return;
    let peer = doc.getPeer(peerId);
    if (!peer) return;
    doc.removePeer(peerId);
  }

  getPeer(docId: DocumentId, peerId: string) {
    let doc = this._syncer(docId);
    if (!doc) return;
    return doc.getPeer(peerId);
  }

  /**
   * Is this contact currently connected to us? i.e., currently online and we
   * have an open connection with them
   * @param {peerId} contact The contact object
   * @return {boolean} If the contact is currently connected
   */
  isConnected(docId: string, peerId: string): boolean {
    let doc = this._syncers.get(docId);
    if (!doc) return false;
    let match = doc.peers.filter((p) => {
      return p.id.match(peerId);
    });
    return match.length > 0;
  }

  /**
   * Make a change to a document.
   * @param docId The document ID
   * @param changeFn The Automerge change function to change the document.
   */
  change<J>(
    docId: DocumentId,
    changeFn: ChangeFn<unknown>,
    message?: string
  ): BinaryChange {
    let doc = this._frontends.get(docId);
    const [newDoc, changeData] = Frontend.change(doc, message, changeFn);
    this._frontends.set(docId, newDoc);
    let syncer = this._syncer(docId);
    if (!syncer)
      this.error(new Error('Document doesnt exist with id ' + docId));
    if (changeData) {
      let change = syncer.change(changeData);
      this.log('storing change', docId);
      syncer.updatePeers();
      return change;
    }
  }

  async loadDocument(
    docId: DocumentId,
    changes: BinaryChange[],
    state: BackendState
  ): Promise<AutomergeDiscovery> {
    const [backend, patch] = Backend.applyChanges(state, changes);
    let frontend: Doc<unknown> = Frontend.applyPatch(Frontend.init(), patch);
    this._frontends.set(docId, frontend);
    let syncer = new AutomergeDiscovery(docId, backend);
    this._syncers.set(docId, syncer);

    syncer.on('patch', ({ docId, patch, changes }) => {
      let frontend = this._frontends.get(docId) as Doc<unknown>;
      if (!frontend) {
        return this.error(
          new Error(
            `No frontend for docId ${docId} .. this should not be happening!`
          )
        );
      }

      let newFrontend: Doc<unknown> = Frontend.applyPatch(frontend, patch);
      this._frontends.set(docId, newFrontend);
    });
    this.log('Document loaded', docId, frontend);
    return syncer;
  }
}
