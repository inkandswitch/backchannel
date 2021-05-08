import { arrayToHex } from 'enc-utils';
import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';
import debug from 'debug';

import * as crypto from './crypto';
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

/**
 * The backchannel class manages the database and wormholes
 */
export class Backchannel extends events.EventEmitter {
  public db: Database;
  private _wormhole: MagicWormhole;
  private _client: Client;
  private _sockets = new Map<ContactId, WebSocket>();
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
  async addContact(contact: IContact): Promise<ContactId> {
    contact.discoveryKey = crypto.computeDiscoveryKey(
      Buffer.from(contact.key, 'hex')
    );
    contact.moniker = contact.moniker || catnames.random();
    return this.db.addContact(contact);
  }

  async addDevice(contact: IContact): Promise<ContactId> {
    contact.mine = 1;
    return this.addContact(contact);
  }

  /**
   * Send a message to a contact. Assumes that you've already
   * connected with the contact from listening to the `contact.connected` event
   * @param {WebSocket} socket: the open socket for the contact
   */
  sendMessage(contactId: ContactId, text: string): IMessage {
    let msg: IMessage = {
      text: text,
      contact: contactId,
      timestamp: Date.now().toString(),
      incoming: false,
    };
    this.log('sending message', msg);
    return this.db.addMessage(msg);
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

  async connectToContactId(cid: ContactId) {
    let contact = await this.db.getContactById(cid);
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
  async announce(code: Code, mine?: boolean): Promise<ContactId> {
    let connection = await this._wormhole.announce(code);
    return this._createContactFromWormhole(connection, mine);
  }

  // redeemer/receiver
  // TODO: rename these functions and dont use flags
  // so it is more clear what's happening...
  async accept(code: Code, mine?: boolean): Promise<ContactId> {
    let connection = await this._wormhole.accept(code);
    return this._createContactFromWormhole(connection, mine);
  }

  /**
   * Is this contact currently connected to us? i.e., currently online and we
   * have an open websocket connection with them
   * @param {ContactId} contactId
   * @return {boolean} connected
   */
  isConnected(contactId: ContactId): boolean {
    return this._sockets.has(contactId);
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

  // PRIVATE
  private _getSocketByContactId(cid: ContactId): WebSocket {
    return this._sockets.get(cid);
  }

  private async _onPeerDisconnect(discoveryKey: DiscoveryKey) {
    let contact = await this.db.getContactByDiscoveryKey(discoveryKey);
    this._sockets.delete(contact.id);
    this.emit('contact.disconnected', { contact });
    this.db.disconnected(contact);
  }

  private async _onPeerConnect(socket: WebSocket, documentId: DiscoveryKey) {
    let contact = await this.db.getContactByDiscoveryKey(documentId);

    try {
      this.db.connected(contact, socket);
    } catch (err) {
      this.log('contact.error', err);
      this.emit('contact.error', err);
    }

    socket.onerror = (err) => {
      console.error('error', err);
      console.trace(err);
    };

    this._sockets.set(contact.id, socket);
    let openContact = {
      socket,
      contact,
      documentId,
    };
    this.log('got contact', openContact.contact, documentId);
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

  private _createContactFromWormhole(
    connection: SecureWormhole,
    mine
  ): Promise<ContactId> {
    let metadata = {
      key: arrayToHex(connection.key),
      mine,
    };

    return this.addContact(metadata);
  }
}
