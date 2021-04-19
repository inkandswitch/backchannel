import Wormhole from './wormhole'
import type { SecureWormhole, MagicWormhole, Code } from './wormhole'
import { arrayToHex } from 'enc-utils'
import { Database, IContact } from './db'
import { Client } from '@localfirst/relay-client'
import { randomBytes } from 'crypto'
import events from 'events'

// TODO: configuring this externally
let RELAY_URL = 'ws://localhost:3000'

export class Contact extends events.EventEmitter {
  connection: SecureWormhole
  metadata: IContact

  constructor (connection: SecureWormhole, metadata: IContact) {
    super()
    this.connection = connection
    this.metadata = metadata
  }

  set moniker (moniker: string) {
    this.metadata.moniker = moniker
  }

  get moniker () {
    return this.metadata.moniker || 'anonymous'
  }

  get key () {
    console.log(this.metadata.key)
    return this.metadata.key
  }

  static create (connection: SecureWormhole) {
    let metadata = { 
      key: arrayToHex(connection.key)
    }
    console.log('creating contact', metadata)
    return new Contact(connection, metadata)
  }
}

/* 
 * The backchannel class manages the database and wormholes
 */
export class Backchannel {
  wormhole: MagicWormhole
  db: Database 
  client: Client

  constructor (dbName) {
    this.wormhole = Wormhole()
    this.db = new Database(dbName)
    console.log('creating client')
    this.client = new Client({
      url: RELAY_URL
    })
    // TODO: catch this error upstream and inform the user properly
    this.db.open().catch(err => {
      console.error(`Database open failed : ${err.stack}`)
    })
  }

  // Join a document and start connecting to peers that have it
  joinDocument (documentId) {
    console.log('joining document')
    this.client
      .join(documentId)
      .on('peer.connect', ({ userName, socket, documentId }) => {
        socket.addEventListener('open', () => {
          console.log('sending hello')
          socket.onerror = err => {
            console.error('error', err)
            console.trace(err)
          }
          socket.onmessage = e => {
            console.log('onmessage')
            const { data } = e
            console.log(data.toString())
          }
          socket.send('hello ' + Math.random())
        })
      })
  }

  async getCode (): Promise<Code> {
    let code = await this.wormhole.getCode()
    return code;
  }

  // sender/initiator
  async announce (code: Code): Promise<Contact> {
    let connection = await this.wormhole.announce(code)
    let contact = Contact.create(connection)
    return contact
  }

  // redeemer/receiver
  async accept (code: Code) : Promise<Contact>{
    let connection = await this.wormhole.accept(code)
    let contact = Contact.create(connection)
    return contact
  }

  async listContacts () {
    return this.db.contacts.toArray()
  }

  async saveContact (contact: Contact) {
    return this.db.contacts.put(contact.metadata)
  }
}
