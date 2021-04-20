```js
type keypair = { 
  publicKey: Buffer,
  privateKey: Buffer
}

let backchannel = new Backchannel(deviceID, keypair) 

// establishing first contact 

let code = await backchannel.getCode()

let contact = await backchannel.announce(code)

// validate petname??
// question for ben: what are the validation constraints for petnames?

// set the petname
contact.petname = 'julia'
contact.save()

// next time i want to talk to them..

let contacts = await backchannel.listContacts()

// click on a contact
let julia = contacts[0]

// julia.petname === 'julia'
// julia.public_key === 'someuniquebuffer'

// documents are conversation threads

let document = julia.documents[0]

let document: Document = await backchannel.joinDocument(document.id)

let messages: Array<Message> = document.messages() 

Message
  .id
  .timestamp
  .contact -> Contact(petname, image)

document.add(Message)
```
