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

  _onmessage(peer) {
    return (msg: Uint8Array) => {
      msg = new Uint8Array(msg);
      this._receive(peer, msg as BinarySyncMessage);
    };
  }

  addPeer(id: string, peer: Peer): ReceiveSyncMsg {
    let exists = this._peers.get(id)
    if (exists) this.removePeer(id)
    this.log('adding peer', id);
    peer.state = Backend.initSyncState();
    this._peers.set(id, peer);

    // HELLO!
    this.log('sending hello');
    this._updatePeer(peer);
    return this._onmessage(peer)
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
