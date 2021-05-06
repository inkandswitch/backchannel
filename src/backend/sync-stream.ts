import { Duplex } from 'stream';
import Automerge from 'automerge';
import { AutomergeDatabase } from './db';
import varint from 'varint';

export class SyncStream extends Duplex {
  private syncState: Automerge.SyncState;
  private doc: Automerge.Doc<AutomergeDatabase>;
  private outgoing: Uint8Array;
  private incoming: Uint8Array;

  constructor(doc: Automerge.Doc<AutomergeDatabase>, options?) {
    super(options);
    this.syncState = Automerge.Backend.initSyncState();
    this.doc = doc;
    this.outgoing = null;
    this.incoming = null;
  }

  _write(chunk, encoding, callback) {
    if (!this.incoming) {
      let length = varint.decode(chunk.slice(0, 8));

      this.incoming = new Uint8Array(length);

      for (var i = 0, offset = 0; i < chunk.length; i++) {
        var part = chunk[i];
        for (var j = 0; j < part.length; j++) {
          this.incoming[offset++] = part[j];
        }
      }
    }
  }

  _read(size) {
    if (!this.outgoing) {
      let message = this._generate();
      if (message === null) return this.push(null);
      var automergeMessageLength = message.byteLength;
      this.outgoing = new Uint8Array([
        varint.encode(automergeMessageLength),
        message,
      ]);
    }

    let buf = this.outgoing.slice(0, size);
    this.outgoing = this.outgoing.slice(size, this.outgoing.length);
    this.push(buf);
  }

  _generate(): Automerge.BinarySyncMessage {
    let [syncState, syncMsg] = Automerge.generateSyncMessage(
      this.doc,
      this.syncState
    );
    this.syncState = syncState;
    console.log('generated sync message', syncMsg);
    return syncMsg;
  }

  _receive(syncMsg: Automerge.BinarySyncMessage): Automerge.BinarySyncMessage {
    console.log('got sync message', syncMsg);
    let [newDoc, syncState, patch] = Automerge.receiveSyncMessage(
      this.doc,
      this.syncState,
      syncMsg
    );
    this.doc = newDoc;
    this.syncState = syncState;
    return;
  }
}
