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
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let done = this._sendSyncMsg(socket);
      socket.onerror = (err) => {
        console.error(err);
        reject(err);
      };
      socket.onclose = () => {
        resolve();
      };
      socket.onmessage = (e) => {
        let msg = e.data;
        console.log('got', msg);
        let decoded = new Uint8Array(msg.split(',').map((s) => parseInt(s)));

        switch (msg) {
          case MUTLIDEVICE_EVENT.DONE:
            console.log('done', done);
            if (done) return resolve();
            done = this._sendSyncMsg(socket);
            break;
          default:
            this.syncState = this._db.receive(this.syncState, decoded);
            done = this._sendSyncMsg(socket);
            this._db.save();
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
      console.log('sending', msg);
      socket.send(msg.toString());
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
