import { Backchannel } from './backchannel';
import crypto from 'crypto';

let doc,
  petbob_id,
  petalice_id = null;
let devices = {
  alice: null,
  bob: null,
};

beforeEach((done) => {
  // start a backchannel on bob and alice's devices
  let dbname = crypto.randomBytes(16);
  let RELAY_URL = 'ws://localhost:3001';
  devices.alice = new Backchannel(dbname + '_a', RELAY_URL);
  devices.bob = new Backchannel(dbname + '_b', RELAY_URL);

  doc = crypto.randomBytes(32).toString('hex');
  // OK, so now I create a petname for bob on alice's device..
  //
  async function create() {
    petbob_id = await devices.alice.addContact({
      key: doc,
      moniker: 'bob',
    });

    // OK, so now I create a petname for bob on alice's device..
    petalice_id = await devices.bob.addContact({
      key: doc,
      moniker: 'alice',
    });
  }

  devices.alice.once('open', () => {
    devices.bob.once('open', () => {
      create().then(done);
      jest.useFakeTimers();
    });
  });
});

afterEach(async () => {
  jest.useRealTimers();
  petalice_id = null;
  petbob_id = null;
  doc = null;
  let promise = Promise.resolve();
  if (devices.alice) await devices.alice.destroy();
  if (devices.bob) await devices.bob.destroy();
  return promise;
});

test('add and retrieve a contact', async () => {
  // create a document, let's say we already did the wormhole handshake
  // TADA!!!
  // and alice can list the contacts and get bob
  let contacts = await devices.alice.listContacts();
  expect(contacts.length).toBe(1);
  expect(contacts[0].moniker).toBe('bob');
  expect(contacts[0].key).toBe(doc);
  expect(contacts[0].id).toBe(petbob_id);

  let bob = await devices.alice.getContactById(petbob_id);
  expect(bob.id).toBe(petbob_id);

  let alice = await devices.bob.getContactById(petalice_id);
  expect(alice.id).toBe(petalice_id);
});

test('integration send a message', (done) => {
  // OK, now let's send bob a message 'hello'
  let outgoing = {
    contact: petbob_id,
    text: 'hello',
  };

  // sending a message
  async function onConnect({ socket, contact }) {
    // only if the contact is bob!
    expect(contact.id).toBe(petbob_id);
    await devices.alice.sendMessage(outgoing.contact, outgoing.text);
  }

  // what we do when bob's device has received the message
  async function onMessage({ message, documentId }) {
    expect(message.text).toBe(outgoing.text);
    done();
  }

  // bob's device has a message!
  devices.bob.on('message', onMessage);
  jest.runOnlyPendingTimers();

  // sending the message once we an open contact
  devices.alice.on('contact.connected', onConnect);
  jest.runOnlyPendingTimers();

  // joining the document on both sides fires the 'contact.connected' event
  devices.alice.connectToContactId(petbob_id);
  devices.bob.connectToContactId(petalice_id);
  jest.runOnlyPendingTimers();
});

test('presence', (done) => {
  // sending a message
  async function onConnect({ socket, contact }) {
    // only if the contact is bob!
    expect(contact.id).toBe(petbob_id);
    // ok bob will now disconnect
    await devices.bob.destroy();
    devices.bob = null;
  }

  async function onDisconnect({ contact, documentId }) {
    // after bob destroys himself, we should get the disconnected event
    expect(contact.id).toBe(petbob_id);
    done();
  }

  // sending the message once we an open contact
  devices.alice.on('contact.connected', onConnect);
  devices.alice.on('contact.disconnected', onDisconnect);
  jest.runOnlyPendingTimers();

  // joining the document on both sides fires the 'contact.connected' event
  devices.alice.connectToContactId(petbob_id);
  devices.bob.connectToContactId(petalice_id);
  jest.runOnlyPendingTimers();
});
