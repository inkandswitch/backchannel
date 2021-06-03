import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';
import debug from 'debug';
import Automerge from 'automerge';
import { v4 as uuid } from 'uuid';
import { serialize, deserialize } from 'bson';

import { System, Database } from './db';
import { FileProgress, Blobs } from './blobs';
import {
  DocumentId,
  Key,
  MessageId,
  Code,
  ContactId,
  IContact,
  TextMessage,
  FileMessage,
  IMessage,
  FileState,
  MessageType,
} from './types';
import { Wormhole } from './wormhole';
import { symmetric, EncryptedProtocolMessage } from './crypto';
import { ReceiveSyncMsg } from './AutomergeDiscovery';

export enum ERROR {
  UNREACHABLE = 404,
  PEER = 500,
}

export enum FileStates {
  QUEUED = 0,
  ERROR = 1,
  SUCCESS = 2,
  PROGRESS = 3,
}

export type BackchannelSettings = {
  relay: string;
};

export interface Mailbox {
  messages: Automerge.List<IMessage>;
}
/**
 * The backchannel class manages the database and wormholes.
 *
 * Call backchannel.db.save() periodically to ensure changes are saved.
 */
export class Backchannel extends events.EventEmitter {
  public db: Database<Mailbox>;
  private _wormhole: Wormhole;
  private _client: Client;
  private _open: boolean;
  private log: debug;
  private _blobs: Blobs;
  private relay: string;

  /**
   * Create a new backchannel client. Each instance represents a user opening
   * the backchannel app on their device. There is one Mailbox per contact which
   * is identified by the contact's discoveryKey.
   * @constructor
   * @param {string} dbName The name of the db for indexeddb
   * @param defaultRelay The default URL of the relay
   */
  constructor(dbName: string, _settings: BackchannelSettings) {
    super();

    this.db = new Database<Mailbox>(
      dbName,
      this.onChangeContactList.bind(this)
    );

    this._blobs = new Blobs();

    this._blobs.on('progress', (p: FileProgress) => {
      this.emit('progress', p);
    });

    this._blobs.on('error', (p: FileProgress) => {
      this.emit('error', p);
    });

    this._blobs.on('sent', (p: FileProgress) => {
      this.emit('sent', p);
    });

    this._blobs.on('download', (p: FileProgress) => {
      this.db.saveBlob(p.id, p.data);
      this.emit('download', p);
    });

    this.db.once('open', () => {
      this.relay =
        (this.db.settings && this.db.settings.relay) || _settings.relay;
      this.log('Connecting to relay', this.relay);
      this._client = this._createClient(this.relay);
      this._wormhole = new Wormhole(this._client);
      this._emitOpen();
    });
    this.log = debug('bc:backchannel');
  }

  onChangeContactList() {
    let tasks = [];
    this.contacts.forEach((c) => {
      try {
        let doc = this.db.getDocument(c.discoveryKey) as Automerge.Doc<Mailbox>;
        if (!doc.messages) throw new Error();
      } catch (err) {
        this.log('creating a document for contact');
        tasks.push(this._addContactDocument(c));
      }
    });

    Promise.all(tasks).then(() => {
      this.connectToAllContacts();
      this.emit('CONTACT_LIST_SYNC');
    });
  }

  async updateSettings(newSettings: BackchannelSettings) {
    const documentIds = this.db.documents;
    if (newSettings.relay !== this.db.settings.relay) {
      this._client = this._createClient(newSettings.relay, documentIds);
      this._wormhole = new Wormhole(this._client);
    }
    let ready = { ...this.db.root.settings, ...newSettings };
    return this.db.changeRoot((doc: System) => {
      doc.settings = ready;
    });
  }

  get settings() {
    return { ...this.db.settings, relay: this.relay };
  }

  private _emitOpen() {
    this.emit('open');
  }

  opened() {
    return this._open;
  }

  /**
   * Create a one-time code for a new backchannel contact.
   * @returns {Code} code The code to use in announce
   */
  getCode(): Promise<Code> {
    return this._wormhole.getCode();
  }

  /**
   * Open a websocket connection to the magic wormhole service and accept the
   * code. Once the contact has been established, a contact will
   * then be created with an anonymous handle and the id returned.
   *
   * @param {Code} code The code to accept
   * @param {number} timeout The timeout before giving up, default 20 seconds
   * @returns {ContactId} The ID of the contact in the database
   */
  async accept(code: Code, timeout = 20000): Promise<ContactId> {
    let TWENTY_SECONDS = timeout;
    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject(
          new Error(`This code has expired. Try again with a different one.`)
        );
      }, TWENTY_SECONDS);
      try {
        let key: Key = await this._wormhole.accept(code.toLowerCase().trim());
        return resolve(key);
      } catch (err) {
        reject(
          new Error(
            'Secure connection failed. Did you type the code correctly? Try again.'
          )
        );
      }
    });
  }

  /**
   * This updates the moniker for a given ccontact and saves the contact in the database
   * @param {ContactId} contactId The contact id to edit
   * @param {string} moniker The new moniker for this contact
   * @returns
   */
  async editMoniker(contactId: ContactId, moniker: string): Promise<void> {
    this.log('editmoniker', contactId, moniker);
    return this.db.editMoniker(contactId, moniker);
  }

  /**
   * Create a new contact in the database
   *
   * @param {Key} key - The key add to the database
   * @returns {ContactId} id - The local id number for this contact
   */
  async addContact(key: Key): Promise<ContactId> {
    let moniker = catnames.random();
    let id = await this.db.addContact(key, moniker);
    let contact = this.db.getContactById(id);
    this.log('adding contact', contact.discoveryKey, contact);
    await this._addContactDocument(contact);
    return contact.id;
  }

  async _addContactDocument(contact: IContact) {
    if (contact.device) return Promise.resolve();
    let docId = await this.db.addDocument(contact, (doc: Mailbox) => {
      doc.messages = [];
    });
    //@ts-ignore
    return this.db.getDocument(docId);
  }

  /**
   * Add a device, which is a special type of contact that has privileged access
   * to syncronize the contact list. Add a key to encrypt the contact list over
   * the wire using symmetric encryption.
   * @param {Key} key The encryption key for this device
   * @param {string} description The description for this device (e.g., "bob's laptop")
   * @returns
   */
  async addDevice(key: Key, description?: string): Promise<ContactId> {
    let moniker = description || 'my device';
    return this.db.addContact(key, moniker, 1);
  }

  /**
   * Get messages with another contact.
   * @param contactId The ID of the contact
   * @returns
   */
  getMessagesByContactId(contactId: ContactId): IMessage[] {
    let contact = this.db.getContactById(contactId);
    try {
      //@ts-ignore
      let doc: Automerge.Doc<Mailbox> = this.db.getDocument(
        contact.discoveryKey
      );
      return doc.messages;
    } catch (err) {
      throw new Error('Error getting messages, this should never happen.');
    }
  }

  /**
   * Returns a list of contacts.
   * @returns An array of contacts
   */
  get contacts(): IContact[] {
    return this.db.getContacts().filter((c) => c.device === 0);
  }

  get devices(): IContact[] {
    return this.db.getContacts().filter((c) => c.device === 1);
  }

  listContacts() {
    return this.contacts;
  }

  /**
   * Send a message to a contact. Assumes that you've already
   * connected with the contact from listening to the `contact.connected` event
   * @param {WebSocket} socket: the open socket for the contact
   */
  async sendMessage(contactId: ContactId, text: string) {
    let msg: TextMessage = {
      id: uuid(),
      target: contactId,
      text: text,
      type: MessageType.TEXT,
      timestamp: Date.now().toString(),
    };
    this.log('sending message', msg);
    let contact = this.db.getContactById(contactId);
    await this._addMessage(msg, contact);
    return msg;
  }

  async sendFile(contactId: ContactId, file: File): Promise<FileMessage> {
    let msg: FileMessage = {
      id: uuid(),
      target: contactId,
      timestamp: Date.now().toString(),
      type: MessageType.FILE,
      mime_type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      name: file.name,
      state: FileState.QUEUED,
    };
    let contact = this.db.getContactById(contactId);
    await this._addMessage(msg, contact);
    let meta = {
      id: msg.id,
      lastModified: msg.lastModified,
      mime_type: msg.mime_type,
      size: msg.size,
      name: msg.name,
    };
    try {
      let sent = await this._blobs.sendFile({
        contactId: contact.id,
        meta,
        file,
      });
      await this._updateFileState(
        msg.id,
        contact.id,
        sent ? FileState.SUCCESS : FileState.ERROR
      );
    } catch (err) {
      this._updateFileState(msg.id, contactId, FileState.ERROR);
    }
    return msg;
  }

  /**
   * Start connecting to the contact.
   * @param {IContact} contact The contact to connect to
   */
  connectToContact(contact: IContact) {
    if (!contact || !contact.discoveryKey)
      throw new Error('contact.discoveryKey required');
    this._client.join('automerge-' + contact.discoveryKey);
    this._client.join('files-' + contact.discoveryKey);
  }

  /**
   * Start connecting to the contact.
   * @param {ContactId} cid The contact id
   */
  connectToContactId(cid: ContactId) {
    this.log('connecting to contact with id', cid);
    let contact = this.db.getContactById(cid);
    this.connectToContact(contact);
  }

  /**
   * Start connecting to all known contacts. Danger: opens a websocket
   * connection for each contact which could be an expensive operation.
   */
  connectToAllContacts() {
    let contacts = this.contacts.concat(this.devices);
    contacts.forEach((contact) => {
      this.connectToContact(contact);
    });
  }

  /**
   * Did the file message fail to send?
   * @param {FileMessage} msg
   * @returns true if there are pending files, false if no pending files
   */
  hasPendingFiles(msg: FileMessage): boolean {
    return this._blobs.hasPendingFiles(msg.target);
  }

  /**
   * Destroy this instance and delete the data. Disconnects from all websocket
   * clients.  Danger! Unrecoverable!
   */
  async destroy() {
    this._open = false;
    await this._client.disconnectServer();
    await this.db.destroy();
    this.emit('close');
  }

  private automergeSocket(
    socket: WebSocket,
    contact: IContact,
    peerId: string
  ) {
    try {
      // Set up send event
      let send = (msg: Uint8Array) => {
        this._encrypt(msg, contact).then((encoded) => {
          this.log('sending', encoded);
          socket.send(encoded);
        });
      };
      let gotAutomergeSyncMsg: ReceiveSyncMsg = this.db.onPeerConnect(
        peerId,
        contact,
        send
      );

      // Setup onmessage event
      let onmessage = (e) => {
        this._decrypt(e.data, contact).then((syncMsg) => {
          this.log('onmessage', syncMsg);
          gotAutomergeSyncMsg(syncMsg);
        });
      };
      socket.addEventListener('message', onmessage);

      // HACK: localfirst/relay-client also has a peer.disconnect event
      // but it is somewhat unreliable.
      let onclose = () => {
        let documentId = contact.discoveryKey;
        socket.removeEventListener('message', onmessage);
        socket.removeEventListener('close', onclose);
        this.db.onDisconnect(documentId, peerId).then(() => {
          this.emit('contact.disconnected', { contact });
        });
      };
      socket.addEventListener('close', onclose);

      contact.isConnected = this.db.isConnected(contact);
      this.log('contact.connected', contact);
      let openContact = {
        socket,
        contact,
      };
      this.emit('contact.connected', openContact);
    } catch (err) {
      this.log('contact.error', err);
      this.emit('contact.error', err);
    }
  }

  async _encrypt(msg: Uint8Array, contact: IContact): Promise<ArrayBuffer> {
    let cipher = await symmetric.encrypt(
      contact.key,
      Buffer.from(msg).toString('hex')
    );
    return serialize(cipher);
  }

  async _decrypt(msg: ArrayBuffer, contact: IContact): Promise<Uint8Array> {
    let decoded = deserialize(msg) as EncryptedProtocolMessage;
    let plainText = await symmetric.decrypt(contact.key, decoded);
    return Uint8Array.from(Buffer.from(plainText, 'hex'));
  }

  private async fileSocket(
    socket: WebSocket,
    contact: IContact,
    peerId: string
  ) {
    let send = async (msg: Uint8Array) => {
      let encoded = await this._encrypt(msg, contact);
      if (isOpen(socket)) socket.send(encoded);
      else throw new Error('SOCKET CLOSED');
    };

    this._blobs.addPeer(contact.id, send);
    let onmessage = async (e) => {
      let decoded = await this._decrypt(e.data, contact);
      this._blobs.receiveFile(contact.id, decoded);
    };

    socket.addEventListener('message', onmessage);
    socket.onclose = () => {
      this._blobs.removePeer(contact.id);
      socket.removeEventListener('message', onmessage);
    };
  }

  private async _onPeerConnect(
    socket: WebSocket,
    documentId: DocumentId,
    userName: string
  ) {
    let onerror = (err) => {
      let code = ERROR.PEER;
      this.emit('error', err, code);
      console.error('error', err);
      console.trace(err);
    };
    socket.addEventListener('error', onerror);

    if (documentId.startsWith('wormhole')) {
      return this.log('got connection to ', documentId); // this is handled by wormhole.ts
    }

    let discoveryKey = documentId.slice(documentId.indexOf('-') + 1);
    let contact = this.db.getContactByDiscoveryKey(discoveryKey);
    let peerId = contact.id + '#' + userName;

    socket.binaryType = 'arraybuffer';
    this.log('onpeer connect', documentId);
    if (documentId.startsWith('files')) {
      return this.fileSocket(socket, contact, peerId);
    }

    if (documentId.startsWith('automerge')) {
      return this.automergeSocket(socket, contact, peerId);
    }
  }

  private _createClient(relay: string, documentIds?: DocumentId[]): Client {
    let client = new Client({
      url: relay,
      documentIds,
    });

    client.on('error', (err) => {
      let error = {
        message: 'Relay unreachable',
        delay: client.retryDelay,
      };
      let code = ERROR.UNREACHABLE;
      this.emit('error', error, code);
    });

    client.on('server.connect', () => {
      this.emit('server.connect');
      this.log('on server connect');
      this._open = true;
    });

    client.on('server.disconnect', () => {
      this.log('on server disconnect');
      this.emit('server.disconnect');
      this._open = false;
    });

    client.on('peer.connect', ({ socket, documentId, userName }) => {
      this._onPeerConnect(socket, documentId, userName);
    });

    return client;
  }

  private async _addMessage(msg: IMessage, contact: IContact) {
    let docId = contact.discoveryKey;
    let res = await this.db.change(docId, (doc: Mailbox) => {
      doc.messages.push(msg);
    });
    return res;
  }

  private async _updateFileState(
    msgId: MessageId,
    contactId: ContactId,
    state: FileState
  ) {
    let contact = this.db.getContactById(contactId);
    if (!contact) return;
    let docId = contact.discoveryKey;
    let res = await this.db.change(docId, (doc: Mailbox) => {
      let idx = doc.messages.findIndex((message) => message.id === msgId);
      //@ts-ignore
      doc.messages[idx].state = state;
    });
    return res;
  }
}

function isOpen(ws) {
  return ws.readyState === ws.OPEN;
}
