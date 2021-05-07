import { DiscoveryKey } from './types';
import { Database } from './db';
import * as crypto from './crypto';
import Automerge from 'automerge';
import msgpack from 'msgpack-lite';

enum MUTLIDEVICE_EVENT {
  DONE = '0',
}

export default class Multidevice {
  private _devices = new Map<DiscoveryKey, Buffer>();
  private _db: Database;
  private syncState: Automerge.SyncState;

  constructor(db) {
    this._db = db;
    this.syncState = Automerge.Backend.initSyncState();
  }

  async sync(
    socket: WebSocket,
    discoveryKey: DiscoveryKey,
    options?
  ): Promise<string> {
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
            if (done) return this._db.save().then(resolve).catch(reject);
            if (this._sendSyncMsg(socket)) {
              done = true;
            }
            break;
          default:
            this.syncState = this._db.receive(this.syncState, decoded);
            if (this._sendSyncMsg(socket)) {
              done = true;
            }
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
      socket.send(MUTLIDEVICE_EVENT.DONE);
      return true;
    } else {
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
