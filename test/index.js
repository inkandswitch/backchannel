let test = require('tape');
let crypto = require('crypto');

let { ContactId, Backchannel } = require('../src/backchannel.tsx');

let devices = {
  alice: null,
  bob: null,
};

function beforeEach() {
  // start a backchannel on bob and alice's devices
  let dbname = crypto.randomBytes(16);
  let RELAY_URL = 'ws://localhost:3000';
  devices.alice = new Backchannel(dbname + '_a', RELAY_URL);
  devices.bob = new Backchannel(dbname + '_b', RELAY_URL);
  console.log('before');
}

test('add and retrieve a contact', async (t) => {
  beforeEach();
  // create a document, let's say we already did the wormhole handshake
  // TADA!!!
  let doc = crypto.randomBytes(16).toString('hex');
  let moniker = 'bob';

  // OK, so now I create a petname for bob on alice's device..
  let petbob_id = await devices.alice.addContact({
    key: doc,
    moniker,
  });

  // OK, so now I create a petname for bob on alice's device..
  let petalice_id = await devices.bob.addContact({
    key: doc,
    moniker: 'alice',
  });

  // and alice can list the contacts and get bob
  let contacts = await devices.alice.listContacts();
  t.equals(contacts.length, 1);
  t.equals(contacts[0].moniker, moniker);
  t.equals(contacts[0].key, doc);
  t.ok(contacts[0].discoveryKey, 'has discovery key');
  t.same(contacts[0].id, petbob_id);

  let bob = await devices.alice.getContactById(petbob_id);
  t.same(bob.id, petbob_id, 'got bob');

  let alice = await devices.bob.getContactById(petalice_id);
  t.same(alice.id, petbob_id, 'got alice');

  await devices.bob.destroy();
  await devices.alice.destroy();
  t.end();
});

test('integration send a message', (t) => {
  return new Promise(async (resolve, reject) => {
    beforeEach();

    let key = crypto.randomBytes(16).toString('hex');
    let moniker = 'bob';

    let petbob_id = await devices.alice.addContact({
      key,
      moniker,
    });

    let petalice_id = await devices.bob.addContact({
      key,
      moniker: 'alice',
    });

    // OK, now let's send bob a message 'hello'
    let outgoing = {
      contact: petbob_id,
      text: 'hello',
    };

    // sending a message
    async function onConnect({ socket, contact }) {
      t.ok(true, 'got contact.connected');
      // only if the contact is bob!
      t.same(contact.id, petbob_id);
      await devices.alice.sendMessage(outgoing.contact, outgoing.text);
    }

    // what we do when bob's device has received the message
    async function onMessage({ message, documentId }) {
      t.ok('got message event');
      t.equals(message.text, outgoing.text, 'got message');

      console.log('on message');
      // ok bob received the message now will self-destruct
      await devices.bob.destroy();
    }

    async function onDisconnect({ contact, documentId }) {
      console.log('wtf');
      // after bob destroys himself, we should get the disconnected event
      t.ok('got contact.disconnected');
      t.same(contact.id, petbob_id, 'got same contact');
      await devices.alice.destroy();
      resolve();
    }

    // bob's device has a message!
    devices.bob.on('message', onMessage);

    // sending the message once we an open contact
    devices.alice.on('contact.connected', onConnect);
    devices.alice.on('contact.disconnected', onDisconnect);

    // joining the document on both sides fires the 'contact.connected' event
    devices.alice.connectToContactId(petbob_id);
    devices.bob.connectToContactId(petalice_id);
  });
});
