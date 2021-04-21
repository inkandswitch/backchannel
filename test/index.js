let test = require('tape')
let crypto = require('crypto')

let { ContactId, Backchannel } = require('../src/backchannel.tsx')

test('create a contact', async (t) => {
  let dbname = crypto.randomBytes(16)
  // start a backchannel on bob and alice's devices
  let alice_device = new Backchannel(dbname + '_a')
  let bob_device = new Backchannel(dbname + '_b')

  // create a document, let's say we already did the wormhole handshake
  // TADA!!!
  let doc = crypto.randomBytes(16).toString('hex')

  // OK, so now I create a petname for bob on alice's device..
  let petbob_id = alice_device.addContact({
    documents: [doc], moniker: 'bob'
  })

  // and alice can list the contacts and get bob
  let contacts = await alice_device.listContacts()
  t.equals(contacts.length, 1)
  t.equals(contacts[0].moniker, 'bob')
  t.equals(contacts[0].documents.length, 1)
  t.equals(contacts[0].documents[0], doc)
  t.ok(contacts[0].id)

  // OK, now let's send bob a message 'hello'
  let outgoing = {
    contact: petbob_id,
    text: 'hello'
  }

  // sending a message
  function sendMessage ({socket, contact}) {
    // only if the contact is bob!
    if (contact.id === petbob_id) {
      alice_device.sendMessage(socket, outgoing)
    }
  }

  // what we do when bob's device has received the message
  async function onMessage ({message, documentId}) {
    console.log(message, documentId)
    t.equals(message.text, outgoing.text)

    await alice_device.db.delete()
    await bob_device.db.delete()
  }

  // bob's device has a message!
  bob_device.on('message', onMessage)

  // sending the message once we an open contact
  alice_device.on('contact.open', sendMessage)

  // joining the document on both sides fires the 'contact.open' event
  alice_device.joinDocument(doc)
  bob_device.joinDocument(doc)
})
