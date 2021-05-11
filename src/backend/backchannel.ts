import { arrayToHex } from 'enc-utils';
import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';
import debug from 'debug';

import * as crypto from './crypto';
import { Database } from './db';
import { Code, ContactId, IContact, IMessage, DiscoveryKey } from './types';
import Wormhole from './wormhole';
import type { SecureWormhole, MagicWormhole } from './wormhole';

/**
 * The backchannel class manages the database and wormholes
 */
export class Backchannel extends events.EventEmitter {
  public db: Database;
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
  constructor(db: Database, relay: string) {
    super();
    this._wormhole = Wormhole();
    this.db = db;
    this.db.on('patch', (patch) => {
      this.emit('patch', patch);
      this.log('patch', patch);
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
   * Create a new contact in the database
   *
   * @param {IContact} contact - The contact to add to the database
   * @returns {ContactId} id - The local id number for this contact
   */
  addContact(contact: IContact): ContactId {
    contact.moniker = contact.moniker || catnames.random();
    contact.device = 0;
    return this.db.addContact(contact);
  }

  addDevice(contact: IContact): ContactId {
    contact.moniker = contact.moniker || 'my device';
    contact.device = 1;
    return this.db.addContact(contact);
  }

  /**
   * Send a message to a contact. Assumes that you've already
   * connected with the contact from listening to the `contact.connected` event
   * @param {WebSocket} socket: the open socket for the contact
   */
  sendMessage(contactId: ContactId, text: string): string {
    let msg: IMessage = {
      text: text,
      timestamp: Date.now().toString(),
    };
    this.log('sending message', msg);
    let contact = this.db.getContactById(contactId);
    return this.db.addMessage(msg, contact.discoveryKey);
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
    return this.addContact(metadata);
  }

  // redeemer/receiver
  async accept(code: Code): Promise<ContactId> {
    let connection = await this._wormhole.accept(code);
    let metadata = this._createContactFromWormhole(connection);
    return this.addContact(metadata);
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
    this.log('onPeerDisconnect');
    this.emit('contact.disconnected', { contact });
    this.db.disconnected(discoveryKey);
  }

  private _onPeerConnect(socket: WebSocket, discoveryKey: DiscoveryKey) {
    let contact = this.db.getContactByDiscoveryKey(discoveryKey);
    try {
      this.db.connected(contact, socket);
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
}
