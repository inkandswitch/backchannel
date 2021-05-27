import {
  BinaryChange,
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

  addPeer(id: string, peer: Peer): ReceiveSyncMsg {
    peer.state = Backend.initSyncState();
    this._peers.set(id, peer);

    // HELLO!
    this.log('sending hello');
    this._updatePeer(peer);

    return (msg: Uint8Array) => {
      let peer = this._peers.get(id);
      if (!peer) return;
      msg = new Uint8Array(msg);
      this._receive(peer, msg as BinarySyncMessage);
      this._updatePeer(peer);
    };
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

  _sendToRenderer(patch: Patch) {
    this.log('emitting patch');
    this.emit('patch', { docId: this.docId, patch });
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
    let [newDoc, newSyncState, patch] = Backend.receiveSyncMessage(
      this.doc,
      peer.state,
      syncMsg
    );
    this.doc = newDoc;
    peer.state = newSyncState;
    this._peers.set(peer.id, peer);
    if (patch) this._sendToRenderer(patch);
    return patch;
  }
}
