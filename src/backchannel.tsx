import Wormhole from './wormhole';
import type { MagicWormhole, Code } from './wormhole';
import { arrayToHex } from 'enc-utils';

export class Contact {
  connection: any 
  key: string

  constructor (connection: any) {
    this.connection = connection
    this.key = arrayToHex(connection.key)
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
    return new Contact(connection)
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
