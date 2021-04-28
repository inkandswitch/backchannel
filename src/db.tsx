import Dexie from 'dexie';
import sodium from 'sodium-javascript';
import msgpack from 'msgpack-lite';

const nonceBytes = sodium.crypto_secretbox_NONCEBYTES;

export type ContactId = number;
export type Code = string;
export type Key = string;
export type DiscoveryKey = string;

export interface IContact {
  id?: ContactId;
  moniker?: string;
  discoveryKey?: DiscoveryKey; // -> hash of code
  key: Key; // -> code I've accepted with them
}

type EncryptedProtocolMessage = {
  cipher: Buffer;
  nonce: Buffer;
};

type SimpleProtocolMessage = {
  text: string;
  timestamp: string;
};

class IMessage {
  id?: number;
  incoming: boolean; // -> incoming or outgoing message
  timestamp: string;
  contact?: number; // -> Contact.id
  text?: string;
  filename?: string;
  mime_type?: string;

  static encode(msg: IMessage, key: Key): Buffer {
    let nonce = sodium.randombytes_buf(nonceBytes);
    let overTheWire: SimpleProtocolMessage = {
      text: msg.text,
      timestamp: msg.timestamp,
    };

    var encrypted = sodium.crypto_secretbox_easy(overTheWire, nonce, key);
    let encoded: EncryptedProtocolMessage = { cipher: encrypted, nonce: nonce };
    return msgpack.encode(encoded);
  }

  static decode(encoded: Buffer, key: Key): IMessage {
    let decoded = msgpack.decode(encoded);
    let nonce = decoded.nonce;
    let decrypted: SimpleProtocolMessage = sodium.crypto_secretbox_open_easy(
      decoded.cipher,
      nonce,
      key
    );
    return {
      text: decrypted.text,
      timestamp: decrypted.timestamp,
      incoming: true,
    };
  }
}

export class Database extends Dexie {
  contacts: Dexie.Table<IContact, number>;
  messages: Dexie.Table<IMessage, number>;

  constructor(dbname) {
    super(dbname);

    this.version(1).stores({
      contacts: 'id++,moniker,&discoveryKey,key',
      messages: 'id++,incoming,text,contact,filename,mime_type',
    });

    // this is just so typescript understands what is going on
    this.contacts = this.table('contacts');
    this.messages = this.table('messages');
  }
}
