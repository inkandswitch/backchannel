let test = require('tape')
let crypto = require('crypto')

let { ContactId, Backchannel } = require('../src/backchannel.tsx')

test('create a contact', async (t) => {
  let dbname = crypto.randomBytes(16)
  let alice_device = new Backchannel(dbname + '_a')
  let bob_device = new Backchannel(dbname + '_b')

  let doc = crypto.randomBytes(16)

  let petbob_id = alice_device.addContact({
    documents: [doc], moniker: 'bob'
  })

  /*
  let petalice = bob_device.addContact({
    documents: [doc], moniker: 'alice'
  })
  */

  let contacts = await alice_device.listContacts()
  t.equals(contacts.length, 1)

  let outgoing = {
    contact: petbob_id,
    text: 'hello'
  }

  async function onMessage ({message, documentId}) {
    console.log(message, documentId)
    t.equals(message.text, outgoing.text)

    await alice_device.db.delete()
    await bob_device.db.delete()
  }

  function sendMessage ({socket, contact}) {
    if (contact.id === petbob_id) {
      alice_device.sendMessage(socket, outgoing)
    }
  }

  bob_device.on('message', onMessage)
  alice_device.on('contact.open', sendMessage)

  alice_device.joinDocument(doc)
  bob_device.joinDocument(doc)
})
