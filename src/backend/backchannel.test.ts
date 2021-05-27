import { Backchannel } from './backchannel';
import { generateKey } from './crypto';
import { randomBytes } from 'crypto';

let doc,
  petbob_id,
  petalice_id = null;
let alice, bob, android: Backchannel;
let server,
  port = 3001;

async function connected(device: Backchannel, id: string) {
  let p = new Promise<any>((resolve) => {
    device.once('contact.connected', async (payload) => {
      jest.runOnlyPendingTimers();
      if (payload.contact.id === id) resolve(payload);
    });
  });
  device.connectToContactId(id);
  jest.runOnlyPendingTimers();
  return p;
}

async function patched(device, id) {
  jest.runOnlyPendingTimers();
  return new Promise<any>((resolve) => {
    device.db.on('patch', async (payload) => {
      jest.runOnlyPendingTimers();
      if (payload.docId === id) resolve(payload);
    });
  });
}

function multidevice(done) {
  android = createDevice(randomBytes(32).toString('hex'));
  android.once('open', async () => {
    jest.runOnlyPendingTimers();
    let key = await generateKey();

    async function onSync() {
      jest.runOnlyPendingTimers();

      android.connectToAllContacts();

      let alices_bob = alice.db.getContactById(petbob_id);
      expect(alices_bob.id).toBe(petbob_id);
      let synced_bob = android.db.getContactById(alices_bob.id);
      expect(synced_bob.key).toBe(alices_bob.key);

      let messages = android.getMessagesByContactId(alices_bob.id);
      expect(messages).toStrictEqual([]);

      let msgText = 'hey alice';
      let docId = synced_bob.discoveryKey;
      jest.runOnlyPendingTimers();
      let allPatched = Promise.all([
        patched(android, docId),
        patched(alice, docId),
      ]);
      await bob.sendMessage(petalice_id, msgText);
      jest.runOnlyPendingTimers();

      await allPatched;
      let msgs = android.getMessagesByContactId(alices_bob.id);
      let og = alice.getMessagesByContactId(alices_bob.id);
      expect(msgs).toStrictEqual(og);

      jest.runOnlyPendingTimers();
      done({
        android,
        alice,
        bob,
      });
    }

    android.once('server.connect', () => {
      let prom2 = alice.addDevice(key, 'my android');
      let prom1 = android.addDevice(key, 'my windows laptop');
      jest.runOnlyPendingTimers();

      Promise.all([prom1, prom2]).then(([alice_id, android_id]) => {
        android.once('CONTACT_LIST_SYNC', () => {
          onSync();
        });
        android.connectToAllContacts();
        alice.connectToAllContacts();
        bob.connectToAllContacts();
        jest.runOnlyPendingTimers();
      });
      jest.runOnlyPendingTimers();
    });
  });
}

function createDevice(name): Backchannel {
  let dbname = randomBytes(16).toString('hex');
  return new Backchannel(dbname, { relay: `ws://localhost:${port}` });
}

beforeEach((done) => {
  // start a backchannel on bob and alice's devices
  alice = createDevice('a');
  bob = createDevice('b');

  generateKey().then((_doc) => {
    // OK, so now I create a petname for bob on alice's device..
    doc = _doc;

    async function create() {
      petbob_id = await alice.addContact(doc);
      await alice.editMoniker(petbob_id, 'bob');

      petalice_id = await bob.addContact(doc);
      await bob.editMoniker(petalice_id, 'alice');
    }

    alice.once('open', () => {
      bob.once('open', () => {
        jest.useFakeTimers();
        create().then(() => {
          Promise.all([
            connected(alice, petbob_id),
            connected(bob, petalice_id),
          ]).then(() => {
            done();
          });
        });
      });
    });
  });
});

afterEach(async () => {
  jest.useRealTimers();
  petalice_id = null;
  petbob_id = null;
  doc = null;
  let promise = Promise.resolve();
  if (alice) await alice.destroy();
  if (bob) await bob.destroy();
  if (android) await android.destroy();
  alice = null;
  bob = null;
  android = null;
  return promise;
});

test('getMessagesByContactId', async () => {
  let msgs = ['hey .... whats up', 'h4x the planet', 'ok bob'];

  let contact = bob.db.getContactById(petalice_id);
  msgs.map((msg) => bob.sendMessage(contact.id, msg));
  let messages = bob.getMessagesByContactId(petalice_id);
  expect(messages.length).toBe(msgs.length);
});

test('integration send a message', async () => {
  // OK, now let's send bob a message 'hello'
  let outgoing = {
    contact: petbob_id,
    text: 'hello',
  };

  expect(alice.opened()).toBe(true);
  expect(bob.opened()).toBe(true);

  await alice.sendMessage(outgoing.contact, outgoing.text);
  jest.runOnlyPendingTimers();
  let docId = bob.db.getDocumentId(bob.db.getContactById(petalice_id));
  await patched(bob, docId);
  jest.runOnlyPendingTimers();
  let messages = bob.getMessagesByContactId(petalice_id);
  expect(messages.length).toBe(1);
  expect(messages[0].text).toBe(outgoing.text);
});

test('presence', (done) => {
  async function onDisconnect({ contact, documentId }) {
    // after bob destroys himself, we should get the disconnected event
    let contacts = alice.contacts;
    expect(contacts[0].isConnected).toBe(false);
    expect(contact.id).toBe(petbob_id);
    done();
  }

  let contacts = alice.contacts;
  expect(contacts[0].isConnected).toBe(true);
  // sending the message once we an open contact
  alice.once('contact.disconnected', onDisconnect);
  jest.runOnlyPendingTimers();
  bob.destroy();
  jest.runOnlyPendingTimers();
});

test('adds and syncs contacts with another device', (done) => {
  multidevice(({ android, alice, bob }) => {
    done();
  });
});

test('editMoniker syncs between two devices', (done) => {
  multidevice(async ({ android, alice, bob }) => {
    let newBobName = 'this is really bob i promise';

    alice.on('CONTACT_LIST_SYNC', () => {
      jest.runOnlyPendingTimers();
      let bb = alice.db.getContactById(petbob_id);
      let ba = android.db.getContactById(petbob_id);
      expect(ba).toStrictEqual(bb);
      done();
    });
    let b = android.db.getContactById(petbob_id);
    expect(b.moniker).toStrictEqual('bob');

    let ba = alice.db.getContactById(petbob_id);
    expect(ba.moniker).toStrictEqual('bob');

    await android.editMoniker(petbob_id, newBobName);
    jest.runOnlyPendingTimers();
  });
});

test('integration send multiple messages', async () => {
  // OK, now let's send bob a message 'hello'
  let outgoing = {
    contact: petbob_id,
    text: 'hello',
  };

  let response = {
    contact: petalice_id,
    text: 'hey bob',
  };

  jest.runOnlyPendingTimers();

  expect(alice.opened()).toBe(true);
  expect(bob.opened()).toBe(true);

  let docId = bob.db.getContactById(petalice_id).discoveryKey;
  let p = patched(bob, docId);
  jest.runOnlyPendingTimers();
  await alice.sendMessage(outgoing.contact, outgoing.text);
  jest.runOnlyPendingTimers();
  await p;

  let messages = bob.getMessagesByContactId(petalice_id);
  expect(messages.length).toBe(1);

  p = patched(alice, docId);
  jest.runOnlyPendingTimers();
  await bob.sendMessage(response.contact, response.text);
  jest.runOnlyPendingTimers();
  await p;

  docId = alice.db.getDocumentId(alice.db.getContactById(petbob_id));
  let alices = alice.getMessagesByContactId(petbob_id);
  expect(alices[0].text).toBe(outgoing.text);
  expect(alices[1].text).toBe(response.text);
  let bobs = bob.getMessagesByContactId(petalice_id);
  expect(alices).toStrictEqual(bobs);
});
