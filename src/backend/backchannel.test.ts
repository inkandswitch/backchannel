import { Backchannel } from './backchannel';
import { Database } from './db';
import crypto from 'crypto';

let doc,
  petbob_id,
  petalice_id = null;
let devices = {
  alice: null,
  bob: null,
  alice_phone: null,
};

function createDevice(name) {
  let dbname = crypto.randomBytes(16);
  let RELAY_URL = 'ws://localhost:3001';
  let db_a = new Database(dbname + name);
  return new Backchannel(db_a, RELAY_URL);
}

beforeEach((done) => {
  // start a backchannel on bob and alice's devices
  devices.alice = createDevice('a');
  devices.bob = createDevice('b');

  doc = crypto.randomBytes(32).toString('hex');
  // OK, so now I create a petname for bob on alice's device..

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

  devices.alice.once('server.connect', () => {
    devices.bob.once('server.connect', () => {
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
  if (devices.alice_phone) await devices.alice_phone.destroy();
  return promise;
});

test('add and retrieve a contact', async () => {
  // create a document, let's say we already did the wormhole handshake
  // TADA!!!
  // and alice can list the contacts and get bob
  let contacts = await devices.alice.db.listContacts();
  expect(contacts.length).toBe(1);
  expect(contacts[0].moniker).toBe('bob');
  expect(contacts[0].key).toBe(doc);
  expect(contacts[0].id).toBe(petbob_id);

  let bob = devices.alice.db.getContactById(petbob_id);
  expect(bob.id).toBe(petbob_id);

  let alice = devices.bob.db.getContactById(petalice_id);
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

  expect(devices.alice.opened()).toBe(true);
  expect(devices.bob.opened()).toBe(true);

  // joining the document on both sides fires the 'contact.connected' event
  devices.alice.connectToContactId(petbob_id);
  devices.bob.connectToContactId(petalice_id);
  jest.runOnlyPendingTimers();
});

test('presence', (done) => {
  // sending a message
  expect(devices.alice.opened()).toBe(true);
  expect(devices.bob.opened()).toBe(true);
  jest.runOnlyPendingTimers();
  async function onConnect({ socket, contact }) {
    // only if the contact is bob!
    expect(contact.id).toBe(petbob_id);
    // ok bob will now disconnect
    jest.runOnlyPendingTimers();
    socket.close();
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

test('adds and syncs contacts with another device', (done) => {
  devices.alice_phone = createDevice('p');

  let key = crypto.randomBytes(32);

  let called = 0;

  async function onSync() {
    jest.runOnlyPendingTimers();
    called++;
    if (called < 2) return;

    let bob = devices.alice.db.getContactById(petbob_id);
    expect(bob.id).toBe(petbob_id);
    let synced_bob = devices.alice_phone.db.getContactById(bob.id);

    expect(synced_bob.key).toBe(bob.key);
    done();
  }

  devices.alice.once('sync.finish', onSync);
  jest.runOnlyPendingTimers();
  devices.alice_phone.once('sync.finish', onSync);
  jest.runOnlyPendingTimers();

  devices.alice.syncDevice(key, 'mac laptop');
  jest.runOnlyPendingTimers();

  devices.alice_phone.on('server.connect', () => {
    devices.alice_phone.syncDevice(key, 'my phone');
    jest.runOnlyPendingTimers();
  });
  jest.runOnlyPendingTimers();
});
