import { Client } from '@localfirst/relay-client';
import events from 'events';
import catnames from 'cat-names';
import debug from 'debug';
import Automerge from 'automerge';
import { v4 as uuid } from 'uuid';
import { serialize, deserialize } from 'bson';

import { System, Database } from './db';
import {
  DocumentId,
  Key,
  Code,
  ContactId,
  IContact,
  IMessage,
  DiscoveryKey,
} from './types';
import { Wormhole } from './wormhole';
import { symmetric, EncryptedProtocolMessage } from './crypto';
import { ReceiveSyncMsg } from './AutomergeDiscovery';

export enum ERROR {
  UNREACHABLE = 404,
  PEER = 500,
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
  private _open = true || false;
  private log = debug;
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

    this.db.once('open', () => {
      let documentIds = this.db.documents;
      this.relay =
        (this.db.settings && this.db.settings.relay) || _settings.relay;
      this.log('Connecting to relay', this.relay);
      this.log(`Joining ${documentIds.length} documentIds`);
      this._client = this._createClient(this.relay, documentIds);
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
          new Error(
            `It took more than 20 seconds to find ${code}. Try again with a different code.`
          )
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
    this.log('root dot created', contact.discoveryKey);
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
    this.log('joining', contact.discoveryKey);
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
    let contacts = this.contacts.concat(this.devices);
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
    await this._client.disconnectServer();
    await this.db.destroy();
    this.emit('close');
  }

  private async _onPeerConnect(
    socket: WebSocket,
    discoveryKey: DiscoveryKey,
    userName: string
  ) {
    let onerror = (err) => {
      let code = ERROR.PEER;
      this.emit('error', err, code);
      console.error('error', err);
      console.trace(err);
    };
    socket.addEventListener('error', onerror);

    if (discoveryKey.startsWith('wormhole')) {
      return this.log('got connection to ', discoveryKey); // this is handled by wormhole.ts
    }
    let contact = this.db.getContactByDiscoveryKey(discoveryKey);
    this.log('onPeerConnect', contact);
    let encryptionKey = contact.key;

    try {
      socket.binaryType = 'arraybuffer';
      let send = (msg: Uint8Array) => {
        symmetric
          .encrypt(encryptionKey, Buffer.from(msg).toString('hex'))
          .then((cipher) => {
            let encoded = serialize(cipher);
            socket.send(encoded);
          });
      };

      let peerId = contact.id + '#' + userName;
      let gotAutomergeSyncMsg: ReceiveSyncMsg = this.db.onPeerConnect(
        peerId,
        contact,
        send
      );

      let onmessage = (e) => {
        let decoded = deserialize(e.data) as EncryptedProtocolMessage;
        symmetric.decrypt(encryptionKey, decoded).then((plainText) => {
          const syncMsg = Uint8Array.from(Buffer.from(plainText, 'hex'));
          gotAutomergeSyncMsg(syncMsg);
        });
      };
      socket.addEventListener('message', onmessage);

      // localfirst/relay-client also has a peer.disconnect event
      // but it is somewhat unreliable. this is better.
      let onclose = () => {
        let documentId = contact.discoveryKey;
        socket.removeEventListener('message', onmessage);
        socket.removeEventListener('error', onerror);
        socket.removeEventListener('close', onclose);
        let peerId = contact.id + '#' + userName;
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
    this.db.save(docId);
    return res;
  }
}
