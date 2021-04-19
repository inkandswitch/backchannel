import Wormhole from './wormhole'
import type { SecureWormhole, MagicWormhole, Code } from './wormhole'
import { arrayToHex } from 'enc-utils'
import { Database, IContact } from './db'

export class Contact {
  connection: SecureWormhole
  metadata: IContact

  constructor (connection: SecureWormhole, metadata: IContact) {
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
    return this.metadata.key
  }

  static create (connection: SecureWormhole) {
    return new Contact(connection, { 
      key: arrayToHex(connection.key)
    })
  }
}

/* 
 * The backchannel class manages the database and wormholes
 */
export class Backchannel {
  wormhole: MagicWormhole
  db: Database 

  constructor (dbName) {
    this.wormhole = Wormhole()
    this.db = new Database(dbName)
    // TODO: catch this error upstream and inform the user properly
    this.db.open().catch(err => {
      console.error(`Database open failed : ${err.stack}`)
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
