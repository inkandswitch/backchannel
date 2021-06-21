// Adapted from saljam/webwormhole
// https://github.com/saljam/webwormhole/blob/master/web/main.js#L125

import { EventEmitter } from 'events';
import debug from 'debug';

type FileMetadata = {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  lastModified?: number;
};

type PendingFile = {
  contactId: string;
  meta: FileMetadata;
  file: File;
};

export type FileProgress = {
  contactId: string;
  id: string;
  progress: number;
  offset: number;
  data?: Uint8Array;
  size: number;
};

export type SendFn = (msg: Uint8Array) => void;

export class Blobs extends EventEmitter {
  private _sending: Map<string, boolean> = new Map<string, boolean>();
  private _connections: Map<string, SendFn> = new Map<string, SendFn>();
  private _sendQueue: Map<string, Array<PendingFile>> = new Map<
    string,
    Array<PendingFile>
  >();
  private _receiving: Map<string, FileProgress> = new Map<
    string,
    FileProgress
  >();
  private log: debug = debug('bc:blobs');

  async drainQueue(contactId: string) {
    let toSend = this._sendQueue.get(contactId);
    if (!toSend) return;
    let pending = toSend.shift();
    if (pending) this.sendFile(pending);
  }

  removePeer(contactId: string) {
    this._connections.delete(contactId);
  }

  hasPendingFiles(contactId: string) {
    let pending = this._sendQueue.get(contactId);
    return pending && pending.length > 0 ? true : false;
  }

  addPeer(contactId: string, fn: SendFn) {
    this._connections.set(contactId, fn);
  }

  addQueue(pendingFile: PendingFile) {
    let { contactId } = pendingFile;
    let queue = this._sendQueue.get(contactId);
    if (!queue) queue = [];
    queue.push(pendingFile);
    this._sendQueue.set(contactId, queue);
  }

  /**
   * Send a file to a contact. Will queue if contact is not currently online.
   * @param pendingFile The pending file
   * @returns true if successful, false if file has been queued
   */
  sendFile(pendingFile: PendingFile) {
    let { contactId, meta, file } = pendingFile;
    return new Promise<boolean>(async (resolve, reject) => {
      let send = this._connections.get(contactId);
      if (!send) return reject();
      if (this._sending.get(contactId)) {
        this.addQueue(pendingFile);
        return resolve(false);
      }

      this._sending.set(contactId, true);

      send(
        new TextEncoder().encode(
          JSON.stringify({
            id: meta.id,
            name: meta.name,
            size: meta.size,
            type: meta.mime_type,
          })
        )
      );
      let reader = this._read(file);
      let sending: FileProgress = {
        contactId,
        id: meta.id,
        offset: 0,
        progress: 0,
        size: meta.size,
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this._sending.set(contactId, false);
          this.emit('sent', sending);
          this.drainQueue(contactId);
          return resolve(true);
        }

        try {
          await send(value);
        } catch (err) {
          this._sending.set(contactId, false);
          return reject(false);
        }
        sending.offset += value.length;
        sending.progress = sending.offset / file.size;
        this.emit('progress', sending);
      }
    });
  }

  /**
   * An internal method that is used if file.stream API is not available. As of
   * writing in May 2021, this is applicable for Firefox for Android, Opera, and
   * Internet Explorer
   *
   * @param file The browser-generated file object
   * @param chunkSize Chunksize, defaults to 64<<10
   * @returns An async interator that mimics the stream interface
   */
  private _read(file: File, chunkSize: number = 64 << 10) {
    let _read = (file, offset) => {
      return new Promise<Uint8Array>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = (e: ProgressEvent<FileReader>) => {
          //@ts-ignore
          resolve(new Uint8Array(e.target.result));
        };

        let end = offset + chunkSize;
        let blob = file.slice(offset, end);
        fr.readAsArrayBuffer(blob);
      });
    };

    return {
      current: 0,
      last: file.size,
      async read() {
        let value: Uint8Array = await _read(file, this.current);
        if (this.current <= this.last) {
          this.current += chunkSize;
          return { done: false, value };
        } else {
          return { done: true };
        }
      },
    };
  }

  /**
   * Receive a file for a contact.
   * @param contact The contact to send it to
   * @param {ArrayBuffer} data The data we're receiving
   * @returns
   */
  receiveFile(contactId: string, data: ArrayBuffer) {
    if (!this._receiving.get(contactId)) {
      let r = JSON.parse(new TextDecoder('utf8').decode(data));
      r.contactId = contactId;
      r.offset = 0;
      r.progress = 0;
      r.data = new Uint8Array(r.size);
      this._receiving.set(contactId, r);
      return;
    }

    const chunkSize = data.byteLength;

    let r = this._receiving.get(contactId);

    if (r.offset + chunkSize > r.size) {
      const error = 'received more bytes than expected';
      throw new Error(error);
    }
    r.data.set(new Uint8Array(data), r.offset);
    r.offset += chunkSize;
    r.progress = r.offset / r.size;
    this._receiving.set(contactId, r);
    this.emit('progress', r);

    if (r.offset === r.size) {
      this.emit('download', r);
      this._receiving.delete(contactId);
    }
  }
}
