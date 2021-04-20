import Dexie from 'dexie'

export interface IContact {
  id?: number,
  moniker?: string,
  documents: Array<string>, // -> codes i've accepted with them
  devices: Array<number>,
  public_key: string
}

export interface IMessage {
  id?: number,
  text: string,
  contact: number, // -> IContact.id 
  filename: string,
  mime_type: string
}

export class Database extends Dexie {
  contacts: Dexie.Table<IContact, number>
  messages: Dexie.Table<IMessage, number>

  constructor (dbname) {
    super(dbname)
    
    this.version(1).stores({
      contacts: 'id++,moniker,*documents,devices,public_key',
      messages: 'id++,text,document_id,contact,filename,mime_type'
    })

    // this is just so typescript understands what is going on
    this.contacts = this.table('contacts')
    this.messages = this.table('messsages')
  }
}
