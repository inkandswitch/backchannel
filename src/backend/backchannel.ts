import { arrayToHex } from 'enc-utils';
import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';
import debug from 'debug';
import Automerge from 'automerge';
import { v4 as uuid } from 'uuid';

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

type DocumentId = string;

export interface Mailbox {
  messages: Automerge.List<string>;
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
    this.db.once('open', () => {
      let documentIds = this.db.documents;
      this.log(`Joining ${documentIds.length} documentIds`);
      this._client = this._createClient(relay, documentIds);
      this._client.on('server.connect', () => {
        this._emitOpen();
      });
    });

    this.log = debug('bc:backchannel');
  }

  private _emitOpen() {
    this._open = true;
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
    let connection: SecureWormhole = await this._wormhole.announce(code);
    let key = arrayToHex(connection.key);
    let id = await this._addContact(key);
    return id;
  }

  /**
   * Open a websocket connection to the magic wormhole service and accept the
   * code. Will fail if someone has not called backchannel.announce(code) on
   * another instance. Once the contact has been established, a contact will
   * then be created with an anonymous handle and the id returned.
   *
   * @param {Code} code The code to accept
   * @returns {ContactId} The ID of the contact in the database
   */
  async accept(code: Code): Promise<ContactId> {
    let connection: SecureWormhole = await this._wormhole.accept(code);
    let key = arrayToHex(connection.key);
    let id = await this._addContact(key);
    return id;
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
   * @param {string} description The description for this device (e.g., "bob's laptop")
   * @param {Buffer} key The encryption key for this device (optional)
   * @returns
   */
  async addDevice(description: string, key?: Buffer): Promise<ContactId> {
    let moniker = description || 'my device';
    return this.db.addDevice(key.toString('hex'), moniker);
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
      return doc.messages.map((msg) => {
        let decoded = IMessage.decode(msg, contact.key);
        decoded.incoming = decoded.target !== contactId;
        return decoded;
      });
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
    return this.db.getContacts().filter((c) => c.device === 0);
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
    let encoded = IMessage.encode(msg, contact.key);
    await this._addMessage(encoded, contact);
    return msg;
  }

  /**
   * Start connecting to the contact.
   * @param {IContact} contact The contact to connect to
   */
  connectToContact(contact: IContact) {
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
    this.contacts.forEach((contact) => {
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
    await this._client.disconnectServer();
    await this.db.destroy();
  }

  private _onPeerConnect(socket: WebSocket, discoveryKey: DiscoveryKey) {
    let contact = this.db.getContactByDiscoveryKey(discoveryKey);
    try {
      socket.binaryType = 'arraybuffer';
      let send = (msg: Uint8Array) => {
        socket.send(msg);
      };

      let onmessage;
      if (contact.device) {
        onmessage = this.db.onDeviceConnect(contact.id, send);
      } else {
        let docId = contact.discoveryKey;
        onmessage = this.db.onPeerConnect(docId, contact.id, send);
      }

      socket.onmessage = (e) => {
        onmessage(e.data);
      };

      this.log('connected', contact.discoveryKey);
    } catch (err) {
      this.log('contact.error', err);
      this.emit('contact.error', err);
    }

    // localfirst/relay-client also has a peer.disconnect event
    // but it is somewhat unreliable. this is better.
    socket.onclose = () => {
      let documentId = contact.discoveryKey;
      this.db.onDisconnect(documentId, contact.id);
      this.log('disconnect!!!!');
      this.emit('contact.disconnected', { contact });
    };

    socket.onerror = (err) => {
      console.error('error', err);
      console.trace(err);
    };

    let openContact = {
      socket,
      contact,
    };
    this.log('got contact', discoveryKey);
    this.emit('contact.connected', openContact);
  }

  private _createClient(relay: string, documentIds: DocumentId[]): Client {
    let client = new Client({
      url: relay,
      documentIds,
    });

    client.once('server.disconnect', () => {
      this.emit('server.disconnect');
    });

    client.on('peer.connect', ({ socket, documentId }) =>
      this._onPeerConnect(socket, documentId)
    );

    return client;
  }

  private async _addMessage(msg: string, contact: IContact) {
    let docId = contact.discoveryKey;
    await this.db.change(docId, (doc: Mailbox) => {
      doc.messages.push(msg);
    });
  }

  /**
   * Create a new contact in the database
   *
   * @param {IContact} contact - The contact to add to the database
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
    return id;
  }
}
