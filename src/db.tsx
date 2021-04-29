import Dexie from 'dexie';
import sodium from 'sodium-javascript';

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

export type EncryptedProtocolMessage = {
  cipher: string;
  nonce: string;
};

export class IMessage {
  id?: number;
  incoming: boolean; // -> incoming or outgoing message
  timestamp: string;
  contact?: number; // -> Contact.id
  text?: string;
  filename?: string;
  mime_type?: string;

  static encode(msg: IMessage, key: Key): string {
    const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
    sodium.randombytes_buf(nonce);
    let message = Buffer.from(msg.text, 'utf-8');
    const cipher = Buffer.alloc(
      message.byteLength + sodium.crypto_secretbox_MACBYTES
    );
    let buf_key = Buffer.from(key, 'hex');
    sodium.crypto_secretbox_easy(cipher, message, nonce, buf_key);
    let encoded: EncryptedProtocolMessage = {
      cipher: cipher.toString('hex'),
      nonce: nonce.toString('hex'),
    };
    return JSON.stringify(encoded);
  }

  static decode(json: string, key: Key): IMessage {
    let decoded: EncryptedProtocolMessage = JSON.parse(json);
    let nonce = Buffer.from(decoded.nonce, 'hex');
    let cipher = Buffer.from(decoded.cipher, 'hex');
    const plainText = Buffer.alloc(
      cipher.byteLength - sodium.crypto_secretbox_MACBYTES
    );
    console.log(nonce.byteLength, sodium.crypto_secretbox_NONCEBYTES);

    sodium.crypto_secretbox_open_easy(
      plainText,
      cipher,
      nonce,
      Buffer.from(key, 'hex')
    );

    return {
      text: plainText.toString('utf-8'),
      timestamp: Date.now().toString(), // FIXME
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
