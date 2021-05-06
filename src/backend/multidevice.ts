import { Key, DiscoveryKey } from './types';
import chacha from 'chacha-stream';
import { Database } from './db';
import * as crypto from './crypto';
import pump from 'pump';

export default class Multidevice {
  private _devices = new Map<DiscoveryKey, Buffer>();
  private _db: Database;

  constructor(db) {
    this._db = db;
  }

  sync(socket: WebSocket, discoveryKey: DiscoveryKey) {
    return new Promise<void>((resolve, reject) => {
      let key: Buffer = this.getDevice(discoveryKey);
      let stream = this._db.createSyncStream();
      var encoder = chacha.encoder(key);
      var decoder = chacha.decoder(key);

      console.log('syncing');
      pump(stream, encoder, socket, decoder, stream, (err) => {
        if (err) return reject(err);
        console.log('complete!');
        resolve();
      });
    });
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
