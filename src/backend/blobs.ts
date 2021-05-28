import { FileMessage, MessageId, IMessage, IContact } from './types';
import { EventEmitter } from 'events';

type PendingFile = {
  contact: IContact,
  msg: FileMessage,
  file: File
}

export type FileProgress = {
  id: MessageId;
  progress: number;
  offset: number;
  data: Uint8Array;
  size: number;
}

export class Blobs extends EventEmitter {
  private _sockets: Map<string, WebSocket> = new Map<string, WebSocket>();
  private _sendQueue: Array<PendingFile> = [];
  private _receiving: Map<string, FileProgress> = new Map<string, FileProgress>();

  drainQueue() {
    this._sendQueue.forEach(pending => {
      this.sendFile(pending);
    });
  }

  addPeer(contact: IContact, socket: WebSocket) {
    this._sockets.set(contact.id, socket)
  }

  sendFile(pendingFile: PendingFile) {
    let { contact, msg, file } = pendingFile;
    return new Promise<void>(async (resolve, reject) => {
      let socket = this._sockets.get(contact.id)
      if (!socket) {
        this._sendQueue.push(pendingFile)
        return reject(new Error('Contact is currently offline. Waiting...'))
      }
      if (!file.stream) throw new Error('file.stream not supported. File failed to send')

      socket.send(new TextEncoder().encode(
        JSON.stringify({
          id: msg.id,
          name: msg.name,
          size: msg.size,
          type: msg.type,
        }),
      ))
      const reader = file.stream().getReader();
      let sending = {
        id: msg.id,
        offset: 0,
        progress: 0
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) return resolve()
        await socket.send(value);
        sending.offset += value.length;
        sending.progress = sending.offset / file.size;
        this.emit('progress', sending)
      }
    });
  }

  receiveFile(contact, data: ArrayBuffer) {
    if (!this._receiving.get(contact.id)) {
      let r = JSON.parse(new TextDecoder("utf8").decode(data));
      r.offset = 0;
      r.progress = 0;
      r.data = new Uint8Array(r.size);
      this._receiving.set(contact.id, r)
      return;
    }

    const chunkSize = data.byteLength;

    let r = this._receiving.get(contact.id)

    if (r.offset + chunkSize > r.size) {
      const error = "received more bytes than expected";
      throw new Error(error)
    }
    r.data.set(new Uint8Array(data), r.offset);
    r.offset += chunkSize;
    r.progress = r.offset / r.size;
    this._receiving.set(contact.id, r)
    this.emit('progress', r)

    if (r.offset === r.size) {
      this.emit('download', r);
      this._receiving.delete(contact.id)
    }
  }
}