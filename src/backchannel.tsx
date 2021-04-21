import Wormhole from './wormhole'
import type { SecureWormhole, MagicWormhole, Code } from './wormhole'
import { arrayToHex } from 'enc-utils'
import { Database, ContactId, IContact, IMessage } from './db'
import { Client } from '@localfirst/relay-client'
import events from 'events'

// TODO: configuring this externally
let RELAY_URL = 'ws://localhost:3000'

/* 
 * The backchannel class manages the database and wormholes
 */
export class Backchannel extends events.EventEmitter {
  wormhole: MagicWormhole
  db: Database 
  client: Client

  /** 
   * Create a new backchannel client. Each instance represents a user opening
   * the backchannel app on their device.
   */

  constructor (dbName) {
    super()
    this.wormhole = Wormhole()
    this.db = new Database(dbName)
    console.log('creating client')
    this.client = new Client({
      url: RELAY_URL
    })
    this._setupListeners()
    // TODO: catch this error upstream and inform the user properly
    this.db.open().catch(err => {
      console.error(`Database open failed : ${err.stack}`)
    })
  }

  /**
   * Create a new contact in the database
   *
   * @param {IContact} contact - The contact to add to the database
   * @returns {ContactId} id - The local id number for this contact
   */
  async addContact (contact: IContact) : Promise<ContactId> {
    return this.db.contacts.add(contact)
  }

  /**
   * Update an existing contact in the database.
   * The contact object should have an `id`
   * @param {IContact} contact - The contact to update to the database
   */
  updateContact (contact: IContact) : Promise<ContactId> {
    return this.db.contacts.put(contact)
  }

  /**
   * Send a message to a contact. Assumes that you've already
   * connected with the contact using `contact.open`
   * @param {WebSocket} socket: the open socket for the contact
   */
  async sendMessage (socket: WebSocket, message: IMessage) {
    // TODO: automerge this 
    if (!message.timestamp) {
      message.timestamp = Date.now().toString()
    }
    let id = await this.db.messages.add(message)
    console.log('sending message', message, id)
    socket.send(JSON.stringify({text: message.text}));
  }

  async getContactByDocument (documentId: string) : Promise<IContact> {
    let contact = await this.db.contacts
      .where('documents')
      .equals(documentId)
      .distinct()
      .toArray()
    if (!contact.length) {
      throw new Error('No contact with that document? that shouldnt be possible. Maybe you cleared your cache...')
    }

    return contact[0]
  }

  // Join a document and start connecting to peers that have it
  joinDocument (documentId) {
    console.log('joining document')
    this.client
      .join(documentId)
  }

  async getCode (): Promise<Code> {
    let code = await this.wormhole.getCode()
    return code;
  }

  // sender/initiator
  async announce (code: Code): Promise<ContactId> {
    let connection = await this.wormhole.announce(code)
    return this._createContactFromWormhole(connection)
  }

  // redeemer/receiver
  async accept (code: Code) : Promise<ContactId>{
    let connection = await this.wormhole.accept(code)
    return this._createContactFromWormhole(connection)
  }

  async listContacts () : Promise<IContact[]> {
    return this.db.contacts.toArray()
  }

  async destroy () {
    console.log('destroying')
    await this.client.disconnect()
    await this.db.delete()
  }

  // PRIVATE
  //

  _setupListeners () {
    this.client
      .on('peer.disconnect', async ({ documentId }) => {
        let contact = await this.getContactByDocument(documentId)
        this.emit('contact.disconnected', {contact, documentId})
      })
      .on('peer.connect', ({ socket, documentId }) => {

        socket.onmessage = e => {
          this.emit('message', {
            documentId, message: JSON.parse(e.data)
          })
        }

        socket.onerror = err => {
          console.error('error', err)
          console.trace(err)
        }


        socket.addEventListener('open', async () => {
          let contact = await this.getContactByDocument(documentId)

          let openContact = {
            socket, contact, documentId
          }
          this.emit('contact.connected', openContact)
        })
      })

  }

  _createContactFromWormhole (connection: SecureWormhole) : Promise<ContactId> {
    let key = arrayToHex(connection.key)

    let metadata = { 
      documents: [key]
    }
    return this.addContact(metadata)
  }

}
