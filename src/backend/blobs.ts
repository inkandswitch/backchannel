import { FileMessage, ContactId, MessageId, IContact } from './types';
import { EventEmitter } from 'events';
import { nextTick } from 'process';

type PendingFile = {
  contact: IContact;
  msg: FileMessage;
  file: File;
};

export type FileProgress = {
  id: MessageId;
  progress: number;
  offset: number;
  data: Uint8Array;
  size: number;
};

export class Blobs extends EventEmitter {
  private _sending: Map<string, boolean> = new Map<string, boolean>();
  private _sockets: Map<string, WebSocket> = new Map<string, WebSocket>();
  private _sendQueue: Map<string, Array<PendingFile>> = new Map<
    string,
    Array<PendingFile>
  >();
  private _receiving: Map<string, FileProgress> = new Map<
    string,
    FileProgress
  >();

  async drainQueue(contactId: ContactId) {
    let toSend = this._sendQueue.get(contactId);
    if (!toSend) return;
    let pending = toSend.shift();
    if (pending) await this.sendFile(pending);
  }

  removePeer(contact: IContact) {
    this._sockets.delete(contact.id);
  }

  hasPendingFiles(contactId: ContactId) {
    let pending = this._sendQueue.get(contactId);
    return pending && pending.length > 0;
  }

  addPeer(contact: IContact, socket: WebSocket) {
    this._sockets.set(contact.id, socket);
    this.drainQueue(contact.id);
  }

  addQueue(pendingFile: PendingFile) {
    let { contact } = pendingFile;
    let queue = this._sendQueue.get(contact.id);
    if (!queue) queue = [];
    queue.push(pendingFile);
    this._sendQueue.set(contact.id, queue);
  }

  sendFile(pendingFile: PendingFile) {
    let { contact, msg, file } = pendingFile;
    return new Promise<boolean>(async (resolve, reject) => {
      let socket = this._sockets.get(contact.id);
      if (!socket || this._sending.get(contact.id)) {
        this.addQueue(pendingFile);
        return resolve(false);
      }
      socket.send(
        new TextEncoder().encode(
          JSON.stringify({
            id: msg.id,
            name: msg.name,
            size: msg.size,
            type: msg.type,
          })
        )
      );
      let reader;
      if (!file.stream) {
        reader = file.stream().getReader();
      } else {
        reader = this._read(file);
      }
      let sending = {
        id: msg.id,
        offset: 0,
        progress: 0,
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this.drainQueue(contact.id);
          resolve(true);
          return;
        }
        await socket.send(value);
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
   * @param offset The offset, defaults to 0
   * @param chunkSize Chunksize, defaults to 64<<10
   * @returns An async interator that mimics the stream interface
   */
  private _read(file: File, offset: number = 0, chunkSize: number = 64 << 10) {
    let _read = (file, offset) =>
      new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = (e: ProgressEvent<FileReader>) => {
          //@ts-ignore
          resolve(new Uint8Array(e.target.result));
        };

        let end = offset + chunkSize;
        let blob = file.slice(offset, end);
        fr.readAsArrayBuffer(blob);
      });

    return {
      current: 0,
      last: file.size,
      async read() {
        let value = await _read(file, this.current);
        if (this.current <= this.last) {
          this.current += chunkSize;
          return { done: false, value };
        } else {
          return { done: true };
        }
      },
    };
  }

  receiveFile(contact, data: ArrayBuffer) {
    if (!this._receiving.get(contact.id)) {
      let r = JSON.parse(new TextDecoder('utf8').decode(data));
      r.offset = 0;
      r.progress = 0;
      r.data = new Uint8Array(r.size);
      this._receiving.set(contact.id, r);
      return;
    }

    const chunkSize = data.byteLength;

    let r = this._receiving.get(contact.id);

    if (r.offset + chunkSize > r.size) {
      const error = 'received more bytes than expected';
      throw new Error(error);
    }
    r.data.set(new Uint8Array(data), r.offset);
    r.offset += chunkSize;
    r.progress = r.offset / r.size;
    this._receiving.set(contact.id, r);
    this.emit('progress', r);

    if (r.offset === r.size) {
      this.emit('download', r);
      this._receiving.delete(contact.id);
    }
  }
}
