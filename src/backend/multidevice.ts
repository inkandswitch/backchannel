import { Key, DiscoveryKey } from './types';
import { Database } from './db';

export default class Multidevice {
  private _devices = new Map<DiscoveryKey, Key>();
  private _db: Database;

  constructor(db) {
    this._db = db;
  }

  sync(socket: WebSocket, key: Key) {}

  set(discoveryKey: DiscoveryKey, key: Key) {
    this._devices.set(discoveryKey, key);
  }

  has(discoveryKey: DiscoveryKey): boolean {
    return this._devices.has(discoveryKey);
  }

  getDevice(discoveryKey): Key {
    return this._devices.get(discoveryKey);
  }
}
