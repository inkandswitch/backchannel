import { Key, DiscoveryKey } from './types';
import { Database } from './db';
import * as crypto from './crypto';

export default class Multidevice {
  private _devices = new Map<DiscoveryKey, Key>();
  private _db: Database;

  constructor(db) {
    this._db = db;
  }

  sync(socket: WebSocket, key: Key) {}

  add(key: Key): DiscoveryKey {
    let discoveryKey = crypto.computeDiscoveryKey(key);
    this._devices.set(discoveryKey, key);
    return discoveryKey;
  }

  has(discoveryKey: DiscoveryKey): boolean {
    return this._devices.has(discoveryKey);
  }

  getDevice(discoveryKey): Key {
    return this._devices.get(discoveryKey);
  }
}
