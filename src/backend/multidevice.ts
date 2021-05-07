import { DiscoveryKey } from './types';
import chacha from 'chacha-stream';
import { Database } from './db';
import * as crypto from './crypto';
import { pipeline } from 'stream';
import Automerge from 'automerge';

enum MUTLIDEVICE_EVENT {
  SYNC = 1,
  DONE = 2,
}

export default class Multidevice {
  private _devices = new Map<DiscoveryKey, Buffer>();
  private _db: Database;
  private syncState: Automerge.SyncState;

  constructor(db) {
    this._db = db;
    this.syncState = Automerge.initSyncState();
  }

  async sync(
    socket: WebSocket,
    discoveryKey: DiscoveryKey,
    options?
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._sendSyncMsg(socket);
      let done = false;
      socket.onmessage = (e) => {
        let decoded = JSON.parse(e.data);

        switch (decoded.event) {
          case MUTLIDEVICE_EVENT.DONE:
            if (done) return resolve();

            if (!this._sendSyncMsg(socket)) {
              done = true;
              resolve();
            }
            return;
          case MUTLIDEVICE_EVENT.SYNC:
            let msg = Uint8Array.from(decoded.msg);
            let state = this._db.receive(this.syncState, msg);
            this.syncState = state;
            this._sendSyncMsg(socket);
            return;
        }
      };
    });
  }

  _sendSyncMsg(socket: WebSocket) {
    let [syncState, msg] = this._db.generate(this.syncState);
    this.syncState = syncState;
    if (msg == null) {
      let j = JSON.stringify({
        event: MUTLIDEVICE_EVENT.DONE,
      });
      console.log('got msg null, closing', j);
      socket.send(j);
      return false;
    }
    let sendable: string = JSON.stringify({
      event: MUTLIDEVICE_EVENT.SYNC,
      msg: Array.from(msg),
    });
    console.log('sending', sendable);
    socket.send(sendable);
    return true;
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
