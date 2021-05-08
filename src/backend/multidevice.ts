import Automerge from 'automerge';
import debug from 'debug';

enum MUTLIDEVICE_EVENT {
  DONE = '0',
}

export default class AutomergeWebsocketSync<T> {
  private _doc: Automerge.Doc<T>;
  private syncState: Automerge.SyncState;
  private log: debug;
  private socket: WebSocket;

  constructor(doc: Automerge.Doc<T>, socket: WebSocket) {
    this._doc = doc;
    this.log = debug('bc:multidevice');
    this.socket = socket;
  }

  async sync(key: Buffer, options?): Promise<Automerge.Patch[]> {
    let socket = this.socket;
    let patches = [];
    this.syncState = Automerge.Backend.initSyncState();
    return new Promise<Automerge.Patch[]>((resolve, reject) => {
      let done = false;
      this._sendSyncMsg(socket);

      socket.onclose = () => {
        this.socket = null;
        this.log('socket closed');
      };

      socket.onerror = (err) => {
        this.log('socket error', err);
        reject(err);
      };

      socket.binaryType = 'arraybuffer';
      socket.onmessage = (e) => {
        let msg = e.data;
        let decoded = new Uint8Array(msg);

        switch (msg) {
          case MUTLIDEVICE_EVENT.DONE:
            if (done) return resolve(patches);
            done = this._sendSyncMsg(socket);
            break;
          default:
            this.log('got sync message');
            let patch = this._receive(this.syncState, decoded);
            patches.push(patch);
            done = this._sendSyncMsg(socket);
            break;
        }
      };
    });
  }

  _sendSyncMsg(socket: WebSocket) {
    let [syncState, msg] = Automerge.generateSyncMessage(
      this._doc,
      this.syncState
    );
    this.syncState = syncState;
    if (msg === null) {
      this.log('sending done');
      socket.send(MUTLIDEVICE_EVENT.DONE);
      return true;
    } else {
      this.log('sending', msg);
      socket.send(msg);
      return false;
    }
  }

  _receive(syncState, syncMsg): Automerge.Patch {
    let [newDoc, s2, patch] = Automerge.receiveSyncMessage(
      this._doc,
      syncState,
      syncMsg
    );
    this._doc = newDoc;
    this.syncState = s2;
    return patch;
  }
}
