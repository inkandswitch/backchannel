import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';
import debug from 'debug';
import Automerge from 'automerge';
import { v4 as uuid } from 'uuid';
import { serialize, deserialize } from 'bson';

import { Database } from './db';
import {
  Key,
  Code,
  ContactId,
  IContact,
  IMessage,
  DiscoveryKey,
} from './types';
import Wormhole from './wormhole';
import type { SecureWormhole, MagicWormhole } from './wormhole';
import { importKey, symmetric, EncryptedProtocolMessage } from './crypto';

type DocumentId = string;

export enum ERROR {
  UNREACHABLE = 404,
  PEER = 500,
}

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
  private _wormhole: MagicWormhole;
  private _client: Client;
  private _open = true || false;
  private log = debug;

  /**
   * Create a new backchannel client. Each instance represents a user opening
   * the backchannel app on their device. There is one Mailbox per contact which
   * is identified by the contact's discoveryKey.
   * @constructor
   * @param db Database<Mailbox> Use a database of type Mailbox, the only document supported currently
   * @param relay string The URL of the relay
   */
  constructor(db: Database<Mailbox>, relay: string) {
    super();
    this._wormhole = Wormhole();
    this.db = db;
    this._client = this._createClient(relay);
    this.db.once('open', () => {
      let documentIds = this.db.documents;
      this._emitOpen();
      this.log(`Joining ${documentIds.length} documentIds`);
      documentIds.forEach((docId) => this._client.join(docId));
    });

    this.log = debug('bc:backchannel');
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
  async getCode(): Promise<Code> {
    let code = await this._wormhole.getCode();
    return code;
  }

  /**
   * Announce the code to the magic wormhole service. This blocks on the
   * recipient of the code calling backchannel.accept(code) on the other side. A
   * contact will then be created with an anonymous handle and the id returned.
   *
   * @param {Code} code The code to announce
   * @returns {ContactId} The ID of the contact in the database
   */
  async announce(code: Code): Promise<ContactId> {
    return new Promise(async (resolve, reject) => {
      try {
        let connection: SecureWormhole = await this._wormhole.announce(
          code.trim()
        );
        let key: Uint8Array = connection.key;
        let id = await this._addContact(Buffer.from(key).toString('hex'));
        return resolve(id);
      } catch (err) {
        console.error(err);
        reject(new Error(`Failed to establish a secure connection.`));
      }
    });
  }

  /**
   * Open a websocket connection to the magic wormhole service and accept the
   * code. Will fail if someone has not called backchannel.announce(code) on
   * another instance. Once the contact has been established, a contact will
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
          new Error(
            `It took more than 20 seconds to find any backchannels with code ${code}. Try again with a different code?`
          )
        );
      }, TWENTY_SECONDS);
      try {
        let connection: SecureWormhole = await this._wormhole.accept(
          code.trim()
        );
        let key: Uint8Array = connection.key;
        let id = await this._addContact(Buffer.from(key).toString('hex'));
        return resolve(id);
      } catch (err) {
        console.error(err);
        reject(new Error(`Failed to establish a secure connection.`));
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
    return this.db.editMoniker(contactId, moniker);
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
    return this.db.addDevice(key, moniker);
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
      console.error('error', err);
      return [];
    }
  }

  /**
   * Returns a list of contacts.
   * @returns An array of contacts
   */
  get contacts(): IContact[] {
    let contacts = this.db.getContacts();
    if (contacts) return contacts.filter((c) => c.device === 0);
    else return [];
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
    let msg: IMessage = {
      id: uuid(),
      target: contactId,
      text: text,
      timestamp: Date.now().toString(),
    };
    this.log('sending message', msg);
    let contact = this.db.getContactById(contactId);
    await this._addMessage(msg, contact);
    return msg;
  }

  /**
   * Start connecting to the contact.
   * @param {IContact} contact The contact to connect to
   */
  connectToContact(contact: IContact) {
    if (!this._open) return;
    if (!contact || !contact.discoveryKey)
      throw new Error('contact.discoveryKey required');
    this._client.join(contact.discoveryKey);
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
    let contacts = this.listContacts();
    contacts.forEach((contact) => {
      this.connectToContact(contact);
    });
  }

  /**
   * Leave a document and disconnect from peers.
   * @param {IContact} contact The contact object
   */
  disconnectFromContact(contact: IContact) {
    if (!contact || !contact.discoveryKey)
      throw new Error('contact.discoveryKey required');
    this._client.leave(contact.discoveryKey);
  }

  /**
   * Destroy this instance and delete the data. Disconnects from all websocket
   * clients.  Danger! Unrecoverable!
   */
  async destroy() {
    this._open = false;
    if (this.opened()) await this._client.disconnectServer();
    await this.db.destroy();
  }

  private async _onPeerConnect(socket: WebSocket, discoveryKey: DiscoveryKey) {
    let onerror = (err) => {
      let code = ERROR.PEER;
      this.emit('error', err, code);
      console.error('error', err);
      console.trace(err);
    };
    socket.addEventListener('error', onerror);

    let contact = this.db.getContactByDiscoveryKey(discoveryKey);
    this.log('onPeerConnect', discoveryKey, contact);
    let encryptionKey = await importKey(contact.key);

    try {
      socket.binaryType = 'arraybuffer';
      let send = (msg: Uint8Array) => {
        this.log('got encryption key', encryptionKey);

        symmetric
          .encrypt(encryptionKey, Buffer.from(msg).toString('hex'))
          .then((cipher) => {
            let encoded = serialize(cipher);
            socket.send(encoded);
          });
      };

      let onmessage;
      if (contact.device) {
        onmessage = await this.db.onDeviceConnect(contact.id, send);
      } else {
        let docId = contact.discoveryKey;
        onmessage = await this.db.onPeerConnect(docId, contact.id, send);
      }

      let listener = (e) => {
        let decoded = deserialize(e.data) as EncryptedProtocolMessage;
        symmetric.decrypt(encryptionKey, decoded).then((plainText) => {
          const syncMsg = Uint8Array.from(Buffer.from(plainText, 'hex'));
          onmessage(syncMsg);
        });
      };
      socket.addEventListener('message', listener);

      // localfirst/relay-client also has a peer.disconnect event
      // but it is somewhat unreliable. this is better.
      let onclose = () => {
        let documentId = contact.discoveryKey;
        socket.removeEventListener('message', listener);
        socket.removeEventListener('error', onerror);
        socket.removeEventListener('close', onclose);
        this.db.onDisconnect(documentId, contact.id).then(() => {
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
      this._open = true;
    });

    client.on('server.disconnect', () => {
      this.emit('server.disconnect');
      this._open = false;
    });

    client.on('peer.connect', ({ socket, documentId }) =>
      this._onPeerConnect(socket, documentId)
    );

    return client;
  }

  private async _addMessage(msg: IMessage, contact: IContact) {
    let docId = contact.discoveryKey;
    let res = await this.db.change(docId, (doc: Mailbox) => {
      doc.messages.push(msg);
    });
    this.db.save(docId);
    return res;
  }

  /**
   * Create a new contact in the database
   *
   * @param {Key} key - The key add to the database
   * @returns {ContactId} id - The local id number for this contact
   */
  private async _addContact(key: Key): Promise<ContactId> {
    let moniker = catnames.random();
    let id = await this.db.addContact(key, moniker);
    let contact = this.db.getContactById(id);
    this.log('root dot created', contact.discoveryKey);
    let docId = await this.db.addDocument(contact.id, (doc: Mailbox) => {
      doc.messages = [];
    });
    this.db.save(docId);
    return contact.id;
  }
}
