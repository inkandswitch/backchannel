import Wormhole from './wormhole';
import type { SecureWormhole, MagicWormhole, Code } from './wormhole';
import { arrayToHex } from 'enc-utils';
import { Key, Database, ContactId, IContact, IMessage } from './db';
import { Client } from '@localfirst/relay-client';
import crypto from 'crypto';
import events from 'events';
import catnames from 'cat-names';

// TODO: configuring this externally
let RELAY_URL = 'ws://localhost:3000';
let instance = null;

/**
 * The backchannel class manages the database and wormholes
 */
export class Backchannel extends events.EventEmitter {
  private _wormhole: MagicWormhole;
  private _db: Database;
  private _client: Client;
  private _sockets = new Map<number, WebSocket>();

  /**
   * Create a new backchannel client. Each instance represents a user opening
   * the backchannel app on their device.
   * @constructor
   * @param {string} dbName - the name of the database saved in IndexedDb
   */
  constructor(dbName) {
    super();
    this._wormhole = Wormhole();
    this._db = new Database(dbName);
    console.log('creating client');
    this._client = new Client({
      url: RELAY_URL,
    });
    this._setupListeners();
    // TODO: catch this error upstream and inform the user properly
    this._db.open().catch((err) => {
      console.error(`Database open failed : ${err.stack}`);
    });
  }

  /**
   * Create a new contact in the database
   *
   * @param {IContact} contact - The contact to add to the database
   * @returns {ContactId} id - The local id number for this contact
   */
  async addContact(contact: IContact): Promise<ContactId> {
    let hash = crypto.createHash('sha256');
    hash.update(contact.key);
    contact.discoveryKey = hash.digest('hex');
    contact.moniker = contact.moniker || catnames.random();
    return this._db.contacts.add(contact);
  }

  /**
   * Update an existing contact in the database.
   * The contact object should have an `id`
   * @param {IContact} contact - The contact to update to the database
   */
  updateContact(contact: IContact): Promise<ContactId> {
    return this._db.contacts.put(contact);
  }

  /**
   * Send a message to a contact. Assumes that you've already
   * connected with the contact from listening to the `contact.connected` event
   * @param {WebSocket} socket: the open socket for the contact
   */
  async sendMessage(contactId: ContactId, text: string): Promise<IMessage> {
    // TODO: automerge this
    let message = {
      text: text,
      contact: contactId,
      timestamp: Date.now().toString(),
      incoming: false,
    };
    let socket: WebSocket = this._getSocketByContactId(contactId);
    let mid = await this._db.messages.add(message);
    console.log('sending message', message, mid);
    // TODO: Message.encode and Message.decode functions
    socket.send(
      JSON.stringify({
        text: message.text,
        timestamp: message.timestamp,
      })
    );
    return message;
  }

  async getMessagesByContactId(cid: ContactId): Promise<IMessage[]> {
    return this._db.messages.where('contact').equals(cid).toArray();
  }

  async getContactById(id: ContactId): Promise<IContact> {
    let contacts = await this._db.contacts.where('id').equals(id).toArray();
    if (!contacts.length) {
      throw new Error('No contact with id');
    }
    return contacts[0];
  }

  /**
   * Get contact by discovery key
   * @param {string} discoveryKey - the discovery key for this contact
   */
  async getContactByDiscoveryKey(discoveryKey: string): Promise<IContact> {
    console.log('looking up contact', discoveryKey);
    let contacts = await this._db.contacts
      .where('discoveryKey')
      .equals(discoveryKey)
      .toArray();
    if (!contacts.length) {
      throw new Error(
        'No contact with that document? that shouldnt be possible. Maybe you cleared your cache...'
      );
    }

    return contacts[0];
  }

  /**
   * Join a document and start connecting to peers that have it
   * @param {DocumentId} documentId
   */
  connectToContact(contact: IContact) {
    console.log('joining', contact.discoveryKey);
    if (!contact || !contact.discoveryKey)
      throw new Error('contact.discoveryKey required');
    this._client.join(contact.discoveryKey);
  }

  /**
   * Leave a document and disconnect from peers
   * @param {DocumentId} documentId
   */
  disconnectFromContact(contact: IContact) {
    console.log('dsiconnecting', contact.discoveryKey);
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

  async listContacts(): Promise<IContact[]> {
    return await this._db.contacts.toArray();
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
    console.log('destroying');
    await this._client.disconnectServer();
    await this._db.delete();
  }

  // PRIVATE
  private _getSocketByContactId(cid: ContactId): WebSocket {
    return this._sockets.get(cid);
  }

  private async _addIncomingMessage(
    contact: IContact,
    text: string,
    timestamp: string
  ): Promise<IMessage> {
    let message: IMessage = {
      text,
      contact: contact.id,
      incoming: true,
      timestamp,
    };
    message.incoming = true;
    let id = await this._db.messages.put(message);
    message.id = id;
    return message;
  }

  private _setupListeners() {
    this._client
      .on('peer.disconnect', async ({ documentId }) => {
        console.log('peer disconnect');
        let contact = await this.getContactByDiscoveryKey(documentId);
        this._sockets.delete(contact.id);
        this.emit('contact.disconnected', { contact });
      })
      .on('peer.connect', async ({ socket, documentId }) => {
        console.log('got documentId', documentId);
        let contact = await this.getContactByDiscoveryKey(documentId);
        console.log('got contact', contact);
        socket.onmessage = (e) => {
          // TODO Message.decode(data)
          let msg = JSON.parse(e.data);
          this._addIncomingMessage(contact, msg.text, msg.timestamp)
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
      });
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

export default function () {
  if (instance) return instance;
  let dbName = 'backchannel_' + window.location.hash;
  instance = new Backchannel(dbName);
  return instance;
}
