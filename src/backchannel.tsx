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

  async compatible () {
    let theirVersions = await this.connection.checkVersion(APP_VERSIONS)
    return theirVersions['alpha'] === true
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
    return new Contact(connection)
  }

  async getCode (): Promise<Code> {
    let code = await this.wormhole.getCode()
    return code;
  }

  async accept (code: Code) : Promise<Contact>{
    let connection = await this.wormhole.accept(code)
    let contact = new Contact(connection)
    if (!await contact.compatible()) throw new Error('Incompatible versions, please upgrade.')
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
