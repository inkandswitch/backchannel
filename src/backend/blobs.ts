import { FileMessage, ContactId, MessageId, IContact } from './types';
import { EventEmitter } from 'events';

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
      if (!file.stream)
        throw new Error('file.stream not supported. File failed to send');

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
      const reader = file.stream().getReader();
      let sending = {
        id: msg.id,
        offset: 0,
        progress: 0,
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this.drainQueue(contact.id);
          return resolve(true);
        }
        await socket.send(value);
        sending.offset += value.length;
        sending.progress = sending.offset / file.size;
        this.emit('progress', sending);
      }
    });
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
