import Automerge from 'automerge';
import debug from 'debug';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export default class AutomergeWebsocketSync<T> extends EventEmitter {
  public doc: Automerge.Doc<T>;
  public socket: WebSocket;
  private syncState: Automerge.SyncState;
  private log: debug;
  private key: Buffer;

  constructor(doc: Automerge.Doc<T>, encryptionKey: Buffer) {
    super();
    this.doc = doc;
    this.key = encryptionKey;
    this.log = debug('bc:multidevice:' + crypto.randomBytes(6).toString('hex'));
  }

  addPeer(socket: WebSocket) {
    this.socket = socket;

    this.syncState = Automerge.initSyncState();
    this._sendSyncMsg();

    socket.binaryType = 'arraybuffer';

    socket.onmessage = (e) => {
      let msg = e.data;
      let decoded = new Uint8Array(msg);
      this.log('got sync message', decoded);
      this._receive(this.syncState, decoded);
      this._sendSyncMsg();
    };
  }

  change(changeFn: Automerge.ChangeFn<unknown>) {
    this.doc = Automerge.change(this.doc, changeFn);
  }

  _sendSyncMsg() {
    let [nextSyncState, msg] = Automerge.generateSyncMessage(
      this.doc,
      this.syncState
    );
    this.syncState = nextSyncState;
    if (msg === null) return false;
    this.log('sending', msg);
    this.socket.send(msg);
    return true;
  }

  _receive(syncState, syncMsg): Automerge.Patch {
    let [newDoc, s2, patch] = Automerge.receiveSyncMessage(
      this.doc,
      syncState,
      syncMsg
    );
    this.doc = newDoc;
    this.syncState = s2;
    this.log('got new sync state');
    if (patch) this.emit('patch', patch);
    return patch;
  }
}
