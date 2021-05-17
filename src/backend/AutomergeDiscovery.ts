import Automerge from 'automerge';
import debug from 'debug';
import { EventEmitter } from 'events';

type PeerId = string;

interface Peer {
  id: string;
  send: Function;
  key?: Buffer;
  state?: Automerge.SyncState;
  idle?: Boolean;
}

enum MESSAGE_TYPES {
  DONE = '0',
}

export default class AutomergeDiscovery<T> extends EventEmitter {
  public doc: Automerge.Doc<T>;
  private peers: Map<PeerId, Peer>;
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

  idle() {
    for (let peerId in this.peers) {
      let p = this.peers.get(peerId);
      if (!p.idle) return false;
    }
    return true;
  }

  addPeer(id: string, peer: Peer) {
    peer.idle = false;
    peer.state = Automerge.initSyncState();
    this.peers.set(id, peer);

    this._sendSyncMsg(peer);
    return (msg) => {
      let peer = this.peers.get(id);
      switch (msg) {
        case MESSAGE_TYPES.DONE:
          if (peer.idle) {
            this.emit('sync', peer.id);
            return;
          }
          break;
        default:
          msg = new Uint8Array(msg);
          this._receive(peer, msg);
          this._sendSyncMsg(peer);
      }
    };
  }

  change(changeFn: Automerge.ChangeFn<T>) {
    this.log('in change function');
    this.doc = Automerge.change(this.doc, changeFn);
    this.peers.forEach((peer) => {
      peer.idle = false;
      this._sendSyncMsg(peer);
    });
  }

  _sendSyncMsg(peer) {
    let [nextSyncState, msg] = Automerge.generateSyncMessage(
      this.doc,
      peer.state
    );
    peer.state = nextSyncState;
    if (msg === null) {
      this.log('sending done');
      peer.idle = true;
      peer.send(MESSAGE_TYPES.DONE);
      return false;
    } else {
      this.log('sending', msg);
      peer.send(msg);
    }
    return true;
  }

  _receive(peer, syncMsg: Automerge.BinarySyncMessage): Automerge.Patch {
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
