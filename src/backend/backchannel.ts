import { arrayToHex } from 'enc-utils';
import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';

import Multidevice from './multidevice';
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
  private _multidevice: Multidevice;
  private _sockets = new Map<ContactId, WebSocket>();
  private _open = true || false;

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
    this._client = this._createClient(relay);
    this._multidevice = new Multidevice(db);
    this._open = false;
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

  /**
   * Send a message to a contact. Assumes that you've already
   * connected with the contact from listening to the `contact.connected` event
   * @param {WebSocket} socket: the open socket for the contact
   */
  async sendMessage(contactId: ContactId, text: string): Promise<IMessage> {
    let msg: IMessage = {
      text: text,
      contact: contactId,
      timestamp: Date.now().toString(),
      incoming: false,
    };
    let socket: WebSocket = this._getSocketByContactId(contactId);
    let mid = await this.db.addMessage(msg);
    let contact = await this.db.getContactById(contactId);
    msg.id = mid;
    let sendable: string = IMessage.encode(msg, contact.key);
    try {
      socket.send(sendable);
    } catch (err) {
      throw new Error('Unable to send message to ' + contact.moniker);
    }
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
  async announce(code: Code): Promise<ContactId> {
    let connection = await this._wormhole.announce(code);
    return this._createContactFromWormhole(connection);
  }

  // redeemer/receiver
  async accept(code: Code): Promise<ContactId> {
    let connection = await this._wormhole.accept(code);
    return this._createContactFromWormhole(connection);
  }

  syncDevice(key: Buffer, description: string) {
    let discoveryKey = this._multidevice.add(key);
    console.log('joining', discoveryKey);
    this._client.join(discoveryKey);
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

  private async _receiveMessage(
    contact: IContact,
    msg: string
  ): Promise<IMessage> {
    let message: IMessage = IMessage.decode(msg, contact.key);
    message.contact = contact.id;
    let id = await this.db.addMessage(message);
    message.id = id;
    return message;
  }

  private async _onPeerDisconnect(documentId: DiscoveryKey) {
    let contact = await this.db.getContactByDiscoveryKey(documentId);
    this._sockets.delete(contact.id);
    this.emit('contact.disconnected', { contact });
  }

  private async _onPeerConnect(socket: WebSocket, documentId: DiscoveryKey) {
    if (this._multidevice.has(documentId)) {
      try {
        console.log('multidevice start', documentId);
        await this._multidevice.sync(socket, documentId);
        this.emit('sync.finish');
      } catch (err) {
        this.emit('sync.error', err);
      }
      return;
    }
    let contact = await this.db.getContactByDiscoveryKey(documentId);
    socket.onmessage = (e) => {
      this._receiveMessage(contact, e.data)
        .then((message) => {
          this.emit('message', {
            contact,
            message,
          });
        })
        .catch((err) => {
          console.error('error', err);
          console.trace(err);
        });
    };

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
    this.emit('contact.connected', openContact);
  }

  private _createClient(relay: string): Client {
    let client = new Client({
      url: relay,
    });

    client.once('server.connect', () => {
      this._open = true;
      this.emit('server.connect');
    });

    client.once('server.disconnect', () => {
      this._open = false;
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
    connection: SecureWormhole
  ): Promise<ContactId> {
    let metadata = {
      key: arrayToHex(connection.key),
    };

    return this.addContact(metadata);
  }
}
