import { EventEmitter } from 'events';
import WormholeFactory from 'magic-wormhole'

export type Code = string

const URL = 'ws://relay.magic-wormhole.io:4000/v1'
const APPID = 'lothar.com/wormhole/text-or-file-xfer'


export class RPC extends EventEmitter {
  factory: WormholeFactory

  constructor (onError: Function) {
    super()
    this.factory = new WormholeFactory(URL, APPID)
    // TODO: catch errors
  }

  generateCode (filename: string): Promise<Code> {
    return new Promise((resolve, reject) => {
      this.factory.getCode()
        .then((code) => {
          resolve(code)
        })
      .catch(reject)
    })
  }

  redeemCode (code: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let dash = code.indexOf('-')
      if (dash === -1) {
        reject(new Error('Code must be of the form 0-word-word'))
      }

      let nameplate = code.slice(0, dash)
      let password = code.slice(dash+1)
      this.factory.accept(nameplate, password)
        .then((wormhole: any) => {
          resolve(wormhole)
        })
        .catch(reject)
    })
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
}

