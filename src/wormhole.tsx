import { WormholeClient, SecureWormhole } from 'magic-wormhole'

export type MagicWormhole = typeof WormholeClient
export type Code = string

const URL = 'ws://relay.magic-wormhole.io:4000/v1'
const APPID = 'lothar.com/wormhole/text-or-file-xfer'

export default function () {
  return new WormholeClient(URL, APPID)
}

