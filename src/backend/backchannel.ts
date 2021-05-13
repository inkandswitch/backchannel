import { arrayToHex } from 'enc-utils';
import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';
import debug from 'debug';
import Automerge from 'automerge';
import { v4 as uuid } from 'uuid';

import { createRootDoc, Database } from './db';
import { Code, ContactId, IContact, IMessage, DiscoveryKey } from './types';
import Wormhole from './wormhole';
import type { SecureWormhole, MagicWormhole } from './wormhole';

export interface Mailbox {
  messages: Automerge.List<string>;
}
/**
 * The backchannel class manages the database and wormholes
 */
export class Backchannel extends events.EventEmitter {
  public db: Database<Mailbox>;
  private _wormhole: MagicWormhole;
  private _client: Client;
  private _open = true || false;
  private log = debug;

  /**
   * Create a new backchannel client. Each instance represents a user opening
   * the backchannel app on their device.
   * @constructor
   * @param {string} dbName - the name of the database saved in IndexedDb
   */
  constructor(db: Database<Mailbox>, relay: string) {
    super();
    this._wormhole = Wormhole();
    this.db = db;
    this.db.on('sync', ({ docId, peerId }) => {
      this.log('sync', { docId, peerId });
      this.emit('sync', { docId, peerId });
    });

    this._client = this._createClient(relay);
    let pending = 2;
    this._client.once('server.connect', () => {
      if (!--pending) this._emitOpen();
    });
    this.db.once('open', () => {
      if (!--pending) this._emitOpen();
    });

    this.log = debug('bc:backchannel');
  }

  _emitOpen() {
    this._open = true;
    this.emit('open');
  }

  opened() {
    return this._open;
  }

  /**
   * This updates the moniker for a given ccontact and saves the contact in the database
   * @param contactId string The contact id to edit
   * @param moniker string The new moniker for this contact
   * @returns
   */
  async editMoniker(contactId: ContactId, moniker: string): Promise<void> {
    this.db.editMoniker(contactId, moniker);
    return this.db.save();
  }

  /**
   * Create a new contact in the database
   *
   * @param {IContact} contact - The contact to add to the database
   * @returns {ContactId} id - The local id number for this contact
   */
  addContact(contact: IContact): ContactId {
    contact.moniker = contact.moniker || catnames.random();
    contact.device = 0;
    let id = this.db.addContact(contact);

    let docId = contact.discoveryKey;
    let doc = createRootDoc<Mailbox>((doc: Mailbox) => {
      doc.messages = [];
    });
    this.db.addDocument(docId, doc);
    return id;
  }

  /**
   * Add a device, which is a special type of contact that has privileged access
   * to syncronize the contact list. Add a key to encrypt the contact list over
   * the wire using symmetric encryption.
   * @param description string The description for this device (e.g., "bob's laptop")
   * @param key Buffer The encryption key for this device (optional)
   * @returns
   */
  addDevice(description: string, key?: Buffer): ContactId {
    let contact: IContact = {
      key: key.toString('hex'),
      moniker: description || 'my device',
      device: 1,
    };
    return this.db.addContact(contact);
  }

  /**
   * Get messages with another contact
   * @param contactId The ID of the contact
   * @returns
   */
  getMessagesByContactId(contactId: ContactId): IMessage[] {
    let contact = this.db.getContactById(contactId);
    return this.db.getDocument(contact.discoveryKey).messages.map((msg) => {
      let decoded = IMessage.decode(msg, contact.key);
      decoded.incoming = decoded.target !== contactId;
      return decoded;
    });
  }

  listContacts(): IContact[] {
    return this.db.getContacts();
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
    this._addMessage(encoded, contact);
    await this.db.save();
    return msg;
  }

  /**
   * Join a document and start connecting to peers that have it
   * @param {DocumentId} documentId
   */
  connectToContact(contact: IContact) {
    if (!contact || !contact.discoveryKey)
      throw new Error('contact.discoveryKey required');
    this._client.join(contact.discoveryKey);
  }

  connectToContactId(cid: ContactId) {
    this.log('connecting to contact with id', cid);
    let contact = this.db.getContactById(cid);
    this.connectToContact(contact);
  }

  /**
   * Leave a document and disconnect from peers
   * @param {DocumentId} documentId
   */
  disconnectFromContact(contact: IContact) {
    if (!contact || !contact.discoveryKey)
      throw new Error('contact.discoveryKey required');
    this._client.leave(contact.discoveryKey);
  }

  async getCode(): Promise<Code> {
    let code = await this._wormhole.getCode();
    return code;
  }

  // sender/initiator
  async announce(code: Code): Promise<ContactId> {
    let connection = await this._wormhole.announce(code);
    let metadata = this._createContactFromWormhole(connection);
    let id = this.addContact(metadata);
    await this.db.save();
    return id;
  }

  // redeemer/receiver
  async accept(code: Code): Promise<ContactId> {
    let connection = await this._wormhole.accept(code);
    let metadata = this._createContactFromWormhole(connection);
    let id = this.addContact(metadata);
    await this.db.save();
    return id;
  }

  /**
   * Destroy this instance and delete the data
   * Disconnects from all websocket clients
   * Danger! Unrecoverable!
   */
  async destroy() {
    this._open = false;
    await this._client.disconnectServer();
    await this.db.destroy();
  }

  private _onPeerDisconnect(discoveryKey: DiscoveryKey) {
    let contact = this.db.getContactByDiscoveryKey(discoveryKey);
    this.db.onDisconnect(discoveryKey, contact.id);
    this.log('onPeerDisconnect');
    this.emit('contact.disconnected', { contact });
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

    socket.onclose = () => {
      this._onPeerDisconnect(discoveryKey);
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

  private _createClient(relay: string): Client {
    let client = new Client({
      url: relay,
    });

    client.once('server.disconnect', () => {
      this.emit('server.disconnect');
    });

    client
      .on('peer.disconnect', ({ documentId }) =>
        this._onPeerDisconnect(documentId)
      )
      .on('peer.connect', ({ socket, documentId }) =>
        this._onPeerConnect(socket, documentId)
      );

    return client;
  }

  private _createContactFromWormhole(connection: SecureWormhole): IContact {
    return {
      key: arrayToHex(connection.key),
      device: 0,
    };
  }

  private _addMessage(msg: string, contact: IContact) {
    let docId = contact.discoveryKey;
    this.db.change(docId, (doc: Mailbox) => {
      doc.messages.push(msg);
    });
  }
}
