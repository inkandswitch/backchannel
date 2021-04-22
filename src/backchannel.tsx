import Wormhole from './wormhole';
import type { SecureWormhole, MagicWormhole, Code } from './wormhole';
import { arrayToHex } from 'enc-utils';
import { Key, Database, ContactId, IContact, IMessage } from './db';
import { Client } from '@localfirst/relay-client';
import crypto from 'crypto'
import events from 'events';

// TODO: configuring this externally
let RELAY_URL = 'ws://localhost:3000';

/*
 * The backchannel class manages the database and wormholes
 */
export class Backchannel extends events.EventEmitter {
  wormhole: MagicWormhole;
  db: Database;
  client: Client;

  /**
   * Create a new backchannel client. Each instance represents a user opening
   * the backchannel app on their device.
   */

  constructor(dbName) {
    super();
    this.wormhole = Wormhole();
    this.db = new Database(dbName);
    console.log('creating client');
    this.client = new Client({
      url: RELAY_URL,
    });
    this._setupListeners();
    // TODO: catch this error upstream and inform the user properly
    this.db.open().catch((err) => {
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
    let hash = crypto.createHash('sha256')
    hash.update(contact.key)
    contact.discoveryKey = hash.digest('hex')
    return this.db.contacts.add(contact);
  }

  /**
   * Update an existing contact in the database.
   * The contact object should have an `id`
   * @param {IContact} contact - The contact to update to the database
   */
  updateContact(contact: IContact): Promise<ContactId> {
    return this.db.contacts.put(contact);
  }

  /**
   * Send a message to a contact. Assumes that you've already
   * connected with the contact using `contact.open`
   * @param {WebSocket} socket: the open socket for the contact
   */
  async sendMessage(socket: WebSocket, message: IMessage) {
    // TODO: automerge this
    if (!message.timestamp) {
      message.timestamp = Date.now().toString();
    }
    let id = await this.db.messages.add(message);
    console.log('sending message', message, id);
    socket.send(JSON.stringify({ text: message.text }));
  }

  async getContactById(id: ContactId): Promise<IContact> {
    let contacts = await this.db.contacts.where('id').equals(id).toArray()
    if (!contacts.length) {
      throw new Error(
        'No contact with id'
      );
    }
    return contacts[0]
  }

  async getContactByDiscoveryKey(discoveryKey: string): Promise<IContact> {
    console.log('looking up contact', discoveryKey)
    let contacts = await this.db.contacts
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
    console.log('joining', contact.discoveryKey)
    if (!contact || !contact.discoveryKey) throw new Error('contact.discoveryKey required')
    this.client.join(contact.discoveryKey);
  }

  /**
   * Leave a document and disconnect from peers 
   * @param {DocumentId} documentId
   */
  disconnectFromContact(contact: IContact) {
    console.log('dsiconnecting', contact.discoveryKey)
    if (!contact || !contact.discoveryKey) throw new Error('contact.discoveryKey required')
    this.client.leave(contact.discoveryKey);
  }

  async getCode(): Promise<Code> {
    let code = await this.wormhole.getCode();
    return code;
  }

  // sender/initiator
  async announce(code: Code): Promise<ContactId> {
    let connection = await this.wormhole.announce(code);
    return this._createContactFromWormhole(connection);
  }

  // redeemer/receiver
  async accept(code: Code): Promise<ContactId> {
    let connection = await this.wormhole.accept(code);
    return this._createContactFromWormhole(connection);
  }

  async listContacts(): Promise<IContact[]> {
    return this.db.contacts.toArray();
  }

  async destroy() {
    console.log('destroying');
    await this.client.disconnect();
    await this.db.delete();
  }

  // PRIVATE
  //

  _setupListeners() {
    this.client
      .on('peer.disconnect', async ({ documentId }) => {
        let contact = await this.getContactByDiscoveryKey(documentId);
        this.emit('contact.disconnected', { contact });
      })
      .on('peer.connect', async ({ socket, documentId }) => {
        console.log('got documentId', documentId)
        let contact = await this.getContactByDiscoveryKey(documentId);
        socket.onmessage = (e) => {
          this.emit('message', {
            contact,
            message: JSON.parse(e.data),
          });
        };

        socket.onerror = (err) => {
          console.error('error', err);
          console.trace(err);
        };

        socket.addEventListener('open', async () => {
          let openContact = {
            socket,
            contact,
            documentId,
          };
          this.emit('contact.connected', openContact);
        });
      });
  }

  _createContactFromWormhole(connection: SecureWormhole): Promise<ContactId> {

    let metadata = {
      key: arrayToHex(connection.key)
    };

    return this.addContact(metadata)
  }
}
