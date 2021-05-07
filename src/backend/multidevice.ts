import { DiscoveryKey } from './types';
import { Database } from './db';
import * as crypto from './crypto';
import Automerge from 'automerge';
import debug from 'debug';

enum MUTLIDEVICE_EVENT {
  DONE = '0',
}

export default class Multidevice {
  private _devices = new Map<DiscoveryKey, Buffer>();
  private _db: Database;
  private syncState: Automerge.SyncState;
  private log: debug;

  constructor(db) {
    this._db = db;
    this.log = debug('bc:multidevice');
  }

  async sync(
    socket: WebSocket,
    discoveryKey: DiscoveryKey,
    options?
  ): Promise<string> {
    this.syncState = Automerge.Backend.initSyncState();
    return new Promise<string>((resolve, reject) => {
      let done = false;
      this._sendSyncMsg(socket);

      socket.onerror = (err) => {
        console.error(err);
        reject(err);
      };

      socket.binaryType = 'arraybuffer';
      socket.onmessage = (e) => {
        let msg = e.data;
        let decoded = new Uint8Array(msg);

        switch (msg) {
          case MUTLIDEVICE_EVENT.DONE:
            this.log('got done', done);
            let conflicts = Automerge.getConflicts(this._db._doc, 'contacts');
            this.log('got conflicts', conflicts);
            if (done) return this._db.save().then(resolve).catch(reject);
            done = this._sendSyncMsg(socket);
            break;
          default:
            this.log('got sync message');
            this.syncState = this._db.receive(this.syncState, decoded);
            done = this._sendSyncMsg(socket);
            break;
        }
      };
    });
  }

  _sendSyncMsg(socket: WebSocket) {
    let [syncState, msg] = Automerge.generateSyncMessage(
      this._db._doc,
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

  add(key: Buffer): DiscoveryKey {
    let discoveryKey = crypto.computeDiscoveryKey(key);
    this._devices.set(discoveryKey, key);
    return discoveryKey;
  }

  has(discoveryKey: DiscoveryKey): boolean {
    return this._devices.has(discoveryKey);
  }

  getDevice(discoveryKey): Buffer {
    return this._devices.get(discoveryKey);
  }
}
