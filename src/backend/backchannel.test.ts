import { Mailbox, Backchannel } from './backchannel';
import { Database } from './db';
import crypto from 'crypto';

let doc,
  petbob_id,
  petalice_id = null;
let devices = {
  alice: null,
  bob: null,
  android: null,
};

function createDevice(name): Backchannel {
  let dbname = crypto.randomBytes(16);
  let RELAY_URL = 'ws://localhost:3001';
  let db_a = new Database<Mailbox>(dbname + name);
  return new Backchannel(db_a, RELAY_URL);
}

beforeEach((done) => {
  // start a backchannel on bob and alice's devices
  devices.alice = createDevice('a');
  devices.bob = createDevice('b');

  doc = crypto.randomBytes(32).toString('hex');
  // OK, so now I create a petname for bob on alice's device..

  async function create() {
    petbob_id = await devices.alice._addContact(doc);
    devices.alice.editMoniker(petbob_id, 'bob');

    petalice_id = await devices.bob._addContact(doc);
    devices.bob.editMoniker(petalice_id, 'alice');
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
  if (devices.android) await devices.android.destroy();
  return promise;
});

test('getMessagesByContactId', async () => {
  let msgs = ['hey .... whats up', 'h4x the planet', 'ok bob'];

  let contact = devices.bob.db.getContactById(petalice_id);
  msgs.map((msg) => devices.bob.sendMessage(contact.id, msg));
  let messages = devices.bob.getMessagesByContactId(petalice_id);
  expect(messages.length).toBe(msgs.length);
});

test('integration send a message', (done) => {
  // OK, now let's send bob a message 'hello'
  let outgoing = {
    contact: petbob_id,
    text: 'hello',
  };

  // sending a message
  async function onConnect({ socket, contact }) {
    expect(contact.id).toBe(petbob_id);
    // bob's device has a message!
    devices.bob.db.on('patch', onSync);
    jest.runOnlyPendingTimers();

    await devices.alice.sendMessage(outgoing.contact, outgoing.text);
    jest.runOnlyPendingTimers();
  }

  // what we do when bob's device has received the message
  async function onSync(docId) {
    jest.runOnlyPendingTimers();
    let messages = devices.bob.getMessagesByContactId(petalice_id);
    expect(messages.length).toBe(1);
    expect(messages[0].text).toBe(outgoing.text);
    done();
  }

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
    let contacts = devices.alice.contacts;
    expect(contacts[0].isConnected).toBe(true);
    socket.close();
    jest.runOnlyPendingTimers();
  }

  async function onDisconnect({ contact, documentId }) {
    // after bob destroys himself, we should get the disconnected event
    let contacts = devices.alice.contacts;
    expect(contacts[0].isConnected).toBe(false);
    expect(contact.id).toBe(petbob_id);
    done();
  }

  let contacts = devices.alice.contacts;
  expect(contacts[0].isConnected).toBe(false);
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
  devices.android = createDevice('p');
  devices.android.on('open', () => {
    let key = crypto.randomBytes(32).toString('hex');

    let called = 0;

    async function onSync(documentId) {
      jest.runOnlyPendingTimers();

      let bob = devices.alice.db.getContactById(petbob_id);
      expect(bob.id).toBe(petbob_id);
      let synced_bob = devices.android.db.getContactById(bob.id);

      expect(synced_bob.key).toBe(bob.key);
      done();
    }

    let prom2 = devices.alice.addDevice(key, 'my android');
    let prom1 = devices.android.addDevice(key, 'my windows laptop');
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();

    Promise.all([prom1, prom2]).then(([alice_id, android_id]) => {
      devices.alice.connectToContactId(android_id);
      jest.runOnlyPendingTimers();
      devices.android.connectToContactId(alice_id);
      jest.runOnlyPendingTimers();
      devices.android.db.on('patch', onSync);
      jest.runOnlyPendingTimers();
    });
    jest.runOnlyPendingTimers();
  });
});

test('integration send multiple messages', (done) => {
  // OK, now let's send bob a message 'hello'
  let outgoing = {
    contact: petbob_id,
    text: 'hello',
  };

  let response = {
    contact: petalice_id,
    text: 'hey bob',
  };

  // sending the message once we an open contact
  devices.alice.on('contact.connected', async ({ socket, contact }) => {
    expect(contact.id).toBe(petbob_id);
    await devices.alice.sendMessage(outgoing.contact, outgoing.text);
    jest.runOnlyPendingTimers();
    devices.bob.db.once('patch', async function () {
      jest.runOnlyPendingTimers();
      let messages = devices.bob.getMessagesByContactId(petalice_id);
      expect(messages.length).toBe(1);
      devices.alice.db.once('patch', onSync);
      await devices.bob.sendMessage(response.contact, response.text);
      jest.runOnlyPendingTimers();
    });
    jest.runOnlyPendingTimers();
  });
  jest.runOnlyPendingTimers();
  // sending a message

  // bob's device has received the message, send a message back.
  async function onSync({ docId, peerId }) {
    jest.runOnlyPendingTimers();
    let messages = devices.alice.getMessagesByContactId(petbob_id);
    expect(messages[0].text).toBe(outgoing.text);
    expect(messages[1].text).toBe(response.text);
    expect(messages[0].incoming).toBe(false);
    expect(messages[1].incoming).toBe(true);
    let alices = devices.alice
      .getMessagesByContactId(petbob_id)
      .forEach((m) => (m.incoming = undefined));
    jest.runOnlyPendingTimers();
    let bobs = devices.bob
      .getMessagesByContactId(petalice_id)
      .forEach((m) => (m.incoming = undefined));
    jest.runOnlyPendingTimers();
    expect(alices).toStrictEqual(bobs);
    done();
  }

  jest.runOnlyPendingTimers();

  expect(devices.alice.opened()).toBe(true);
  expect(devices.bob.opened()).toBe(true);

  // joining the document on both sides fires the 'contact.connected' event
  devices.alice.connectToContactId(petbob_id);
  devices.bob.connectToContactId(petalice_id);
  jest.runOnlyPendingTimers();
});
