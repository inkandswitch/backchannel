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

interface Peer {
  id: string;
  send: Function;
  key?: Buffer;
  state?: SyncState;
  idle?: Boolean;
}

enum MESSAGE_TYPES {
  DONE = '0',
  HELLO = '1',
}

export default class AutomergeDiscovery extends EventEmitter {
  public doc: BackendState;
  public docId: string;
  private peers: Map<PeerId, Peer>;
  private log: debug;

  constructor(docId: string, backend?: BackendState) {
    super();
    this.doc = backend || Backend.init();
    this.docId = docId;
    this.peers = new Map<PeerId, Peer>();
    this.log = debug('bc:AutomergePeers');
  }

  removePeer(id): boolean {
    return this.peers.delete(id);
  }

  hasPeer(id): boolean {
    return this.peers.has(id);
  }

  idle() {
    for (let peerId in this.peers) {
      let p = this.peers.get(peerId);
      if (!p.idle) return false;
    }
    return true;
  }

  addPeer(id: string, peer: Peer) {
    peer.idle = false;
    peer.state = Backend.initSyncState();
    this.peers.set(id, peer);

    // HELLO!
    this._updatePeer(peer);

    return (msg) => {
      let peer = this.peers.get(id);
      switch (msg) {
        case MESSAGE_TYPES.DONE:
          if (peer.idle) {
            this.emit('sync', peer.id);
            this.log('got done');
          }
          this._updatePeer(peer);
          break;
        default:
          // RECEIVED
          msg = new Uint8Array(msg);
          this._receive(peer, msg);
          this._updatePeer(peer);
      }
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
    return newChange;
  }

  updatePeers() {
    this.peers.forEach((peer) => {
      peer.idle = false;
      this._updatePeer(peer);
    });
  }

  _sendToRenderer(patch: Patch) {
    this.log('emitting patch', this.docId);
    this.emit('patch', { docId: this.docId, patch });
  }

  _updatePeer(peer) {
    let [nextSyncState, msg] = Backend.generateSyncMessage(
      this.doc,
      peer.state
    );
    peer.state = nextSyncState;
    if (msg) {
      this.log('sending', msg);
      peer.send(msg);
      return true;
    } else {
      if (!peer.idle) {
        peer.send(MESSAGE_TYPES.DONE);
        peer.idle = true;
      }
      return false;
    }
  }

  _receive(peer, syncMsg: BinarySyncMessage): Patch {
    let [newDoc, newSyncState, patch] = Backend.receiveSyncMessage(
      this.doc,
      peer.state,
      syncMsg
    );
    this.doc = newDoc;
    peer.state = newSyncState;
    this.peers.set(peer.id, peer);
    if (patch) this._sendToRenderer(patch);
    return patch;
  }
}
