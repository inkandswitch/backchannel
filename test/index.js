let test = require('tape')
let crypto = require('crypto')

let { ContactId, Backchannel } = require('../src/backchannel.tsx')

test('integration send a message', (t) => {
  return new Promise(async (resolve, reject) => {
    t.plan(11)

    // give 10 seconds to join a document and send a message
    setTimeout(() => {
      reject(new Error('timed out!'))
    }, 10000)

    // start a backchannel on bob and alice's devices
    let dbname = crypto.randomBytes(16)
    let alice_device = new Backchannel(dbname + '_a')
    let bob_device = new Backchannel(dbname + '_b')

    // create a document, let's say we already did the wormhole handshake
    // TADA!!!
    let doc = crypto.randomBytes(16).toString('hex')
    let moniker = 'bob'

    // OK, so now I create a petname for bob on alice's device..
    let petbob_id = await alice_device.addContact({
      documents: [doc], moniker
    })

    // and alice can list the contacts and get bob
    let contacts = await alice_device.listContacts()
    t.equals(contacts.length, 1)
    t.equals(contacts[0].moniker, moniker)
    t.equals(contacts[0].documents.length, 1)
    t.equals(contacts[0].documents[0], doc)
    t.same(contacts[0].id, petbob_id)

    // OK, now let's send bob a message 'hello'
    let outgoing = {
      contact: petbob_id,
      text: 'hello'
    }

    // sending a message
    async function onConnect ({socket, contact}) {
      t.ok('got contact.connected')
      // only if the contact is bob!
      if (contact.id === petbob_id) {
        await alice_device.sendMessage(socket, outgoing)
      }
    }

    // what we do when bob's device has received the message
    async function onMessage ({message, documentId}) {
      t.ok('got message event')
      t.equals(message.text, outgoing.text, 'got message')

      // ok bob received the message now will self-destruct
      await bob_device.destroy()
    }

    function onDisconnect ({contact, documentId}) {
      // after bob destroys himself, we should get the disconnected event
      t.ok('got contact.disconnected')
      t.same(contact.id, petbob_id, 'got same contact')
      t.same(documentId, doc, 'got document id')
      alice_device.destroy()
      resolve()
    }

    // bob's device has a message!
    bob_device.on('message', onMessage)

    // sending the message once we an open contact
    alice_device.on('contact.connected', onConnect)
    alice_device.on('contact.disconnected', onDisconnect)

    // joining the document on both sides fires the 'contact.connected' event
    alice_device.joinDocument(doc)
    bob_device.joinDocument(doc)
  })
})
