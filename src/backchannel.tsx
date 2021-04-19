import Wormhole from './wormhole'
import type { MagicWormhole, Code } from './wormhole'
import { arrayToHex } from 'enc-utils'

let APP_VERSIONS = {
  'alpha': true
}

export type ContactMetadata = {
  moniker: string
}

export class Contact {
  connection: any 
  key: string
  metadata: ContactMetadata

  constructor (connection: any) {
    this.connection = connection
    this.key = arrayToHex(connection.key)
  }

  update (metadata: ContactMetadata) {
    this.metadata = metadata
    this._save()
  }

  _save () {

  }
}

/* 
 * The backchannel class manages the database and wormholes
 */
export class Backchannel {
  wormhole: MagicWormhole

  constructor () {
    this.wormhole = Wormhole()
  }

  async announce (code: Code): Promise<Contact> {
    let connection = await this.wormhole.announce(code)
    let contact = new Contact(connection)
    return contact
  }

  async getCode (): Promise<Code> {
    let code = await this.wormhole.getCode()
    return code;
  }

  async accept (code: Code) : Promise<Contact>{
    console.log('accepting')
    let connection = await this.wormhole.accept(code)
    console.log('got contact')
    let contact = new Contact(connection)
    return contact
  }

  addContact (key: string, name: string): Promise<string> {
    return new Promise((resolve, reject) => {
      resolve('OK')
    })
  }

  listContacts (): Promise<any> {
    return new Promise((resolve, reject) => {
      resolve(['Joe', 'Dan', 'Jennie'])
    })
  }


  /*
  async openExisting (contactId): Promise<Contact> {
  }
  */
}
