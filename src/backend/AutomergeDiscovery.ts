import Automerge from 'automerge';
import debug from 'debug';
import { EventEmitter } from 'events';

type PeerId = string;
interface Peer {
  id: string;
  send: Function;
  state: Automerge.SyncState;
  updated: false;
}

enum MESSAGE_TYPES {
  DONE = '0',
}

export default class AutomergeDiscovery<T> extends EventEmitter {
  public doc: Automerge.Doc<T>;
  private peers: Map<PeerId, Automerge.SyncState>;
  private log: debug;

  constructor(doc: Automerge.Doc<T>) {
    super();
    this.doc = doc;
    this.peers = new Map<PeerId, Peer>();
    this.log = debug('bc:AutomergePeers');
  }

  removePeer(id): boolean {
    return this.peers.delete(id);
  }

  hasPeer(id): boolean {
    return this.peers.has(id);
  }

  addPeer(id: string, send) {
    let peer = { id, send, state: Automerge.initSyncState() };
    this.peers[id] = peer;

    this._sendSyncMsg(peer);
    return (msg) => {
      let peer = this.peers[id];
      switch (msg) {
        case MESSAGE_TYPES.DONE:
          if (peer.updated) {
            this.emit('sync');
            return;
          }
          break;
        default:
          let decoded = new Uint8Array(msg);
          this._receive(peer, decoded);
          this._sendSyncMsg(peer);
      }
    };
  }

  change(changeFn: Automerge.ChangeFn<T>) {
    this.doc = Automerge.change(this.doc, changeFn);
    for (let id in this.peers) {
      let peer = this.peers[id];
      peer.updated = false;
      this._sendSyncMsg(peer);
    }
  }

  _sendSyncMsg(peer) {
    let [nextSyncState, msg] = Automerge.generateSyncMessage(
      this.doc,
      peer.state
    );
    peer.state = nextSyncState;
    if (msg === null) {
      this.log('sending done');
      peer.updated = true;
      peer.send(MESSAGE_TYPES.DONE);
      return false;
    }
    this.log('sending', msg);
    peer.send(msg);
    return true;
  }

  _receive(peer, syncMsg): Automerge.Patch {
    let [newDoc, s2, patch] = Automerge.receiveSyncMessage(
      this.doc,
      peer.state,
      syncMsg
    );
    this.doc = newDoc;
    peer.state = s2;
    this.log('got new sync state', s2);
    if (patch) this.emit('patch', patch);
    return patch;
  }
}
