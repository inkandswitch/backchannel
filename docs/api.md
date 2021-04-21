
This was a bit of an experiment/brainstorm, we will be iterating on the API and can autogenerate them from 
jsdoc 

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
await backchannel.updateContact(contact, {
  moniker: 'julia'
})

// next time i want to talk to them..

let contacts = await backchannel.listContacts()

// click on a contact
let julia = contacts[0]

// julia.petname === 'julia'
// julia.public_key === 'someuniquebuffer'


// there is only one document per contact
let document = await backchannel.connect(julia)

backchannel.on('message', ({documentId, messageId}) => {
  let document = backchannel.getDocument(documentId)
  let message = backchannel.getMessage(documentId, messageId)
  let messages: Array<Message> = document.messages() 
  
  // Update the UI
})

Message
  .id
  .timestamp
  .contact -> Contact(petname, image)

let message = await backchannel.sendMessage(julia, { text })

```
