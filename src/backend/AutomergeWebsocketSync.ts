import Automerge from 'automerge';
import debug from 'debug';
import { EventEmitter } from 'events';
import crypto from 'crypto';

type PeerId = string;
interface Peer {
  id: string;
  socket: WebSocket;
  state: Automerge.SyncState;
}

export default class AutomergeWebsocketSync<T> extends EventEmitter {
  public doc: Automerge.Doc<T>;
  public socket: WebSocket;
  private peers: Map<PeerId, Automerge.SyncState>;
  private log: debug;

  constructor(doc: Automerge.Doc<T>) {
    super();
    this.doc = doc;
    this.peers = new Map<PeerId, Peer>();
    this.log = debug('bc:multidevice:' + crypto.randomBytes(6).toString('hex'));
  }

  addPeer(id: string, socket: WebSocket) {
    let peer = { id, socket, state: Automerge.initSyncState() };
    this.peers[id] = peer;
    this._sendSyncMsg(peer);

    socket.binaryType = 'arraybuffer';

    socket.onmessage = (e) => {
      let peer = this.peers[id];
      let msg = e.data;
      let decoded = new Uint8Array(msg);
      this._receive(peer, decoded);
    };
  }

  change(changeFn: Automerge.ChangeFn<unknown>) {
    this.doc = Automerge.change(this.doc, changeFn);
  }

  _sendSyncMsg(peer) {
    let [nextSyncState, msg] = Automerge.generateSyncMessage(
      this.doc,
      peer.state
    );
    peer.state = nextSyncState;
    if (msg === null) {
      this.emit('sync');
      return false;
    }
    this.log('sending', msg);
    peer.socket.send(msg);
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
    this._sendSyncMsg(peer);
    return patch;
  }
}
