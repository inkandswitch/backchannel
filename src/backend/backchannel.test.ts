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
      if (payload.contact.id === id) resolve(payload);
    });
  });
  device.connectToContactId(id);
  return p;
}

async function patched(device, id) {
  return new Promise<any>((resolve) => {
    let onPatch = async (payload) => {
      if (payload.docId === id) {
        device.db.removeListener('patch', onPatch);
        resolve(payload);
      }
    };
    device.db.on('patch', onPatch);
  });
}

function multidevice(done) {
  android = createDevice();
  android.once('open', async () => {
    let key = await generateKey();

    async function onSync() {
      android.connectToContactId(petbob_id);

      let alices_bob = alice.db.getContactById(petbob_id);
      expect(alices_bob.id).toBe(petbob_id);
      let synced_bob = android.db.getContactById(alices_bob.id);
      expect(synced_bob.key).toBe(alices_bob.key);

      let messages = android.getMessagesByContactId(alices_bob.id);
      expect(messages).toStrictEqual([]);

      let msgText = 'hey alice';
      let docId = synced_bob.discoveryKey;
      let allPatched = Promise.all([
        patched(android, docId),
        patched(alice, docId),
      ]);
      await bob.sendMessage(petalice_id, msgText);

      await allPatched;
      let msgs = android.getMessagesByContactId(alices_bob.id);
      let og = alice.getMessagesByContactId(alices_bob.id);
      expect(msgs).toStrictEqual(og);

      done({
        android,
        alice,
        bob,
      });
    }

    android.once('server.connect', () => {
      let prom2 = alice.addDevice(key, 'my android');
      let prom1 = android.addDevice(key, 'my windows laptop');

      Promise.all([prom1, prom2]).then(([alice_id, android_id]) => {
        android.once('CONTACT_LIST_SYNC', () => {
          onSync();
        });
        android.connectToContactId(alice_id);
        alice.connectToContactId(android_id);
      });
    });
  });
}

function createDevice(): Backchannel {
  let dbname = randomBytes(16).toString('hex');
  return new Backchannel(dbname, { relay: `ws://localhost:${port}` });
}

beforeEach((done) => {
  // start a backchannel on bob and alice's devices
  alice = createDevice();
  bob = createDevice();

  generateKey().then((_doc) => {
    // OK, so now I create a petname for bob on alice's device..
    doc = _doc;

    async function create() {
      petbob_id = await alice.addContact(doc);
      await alice.editMoniker(petbob_id, 'bob');

      petalice_id = await bob.addContact(doc);
      await bob.editMoniker(petalice_id, 'alice');
      alice.connectToAllContacts();
      bob.connectToAllContacts();
    }

    alice.once('open', () => {
      bob.once('open', () => {
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

  let docId = bob.db.getDocumentId(bob.db.getContactById(petalice_id));
  let p = patched(bob, docId);
  await alice.sendMessage(outgoing.contact, outgoing.text);
  await p;
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
  bob.destroy();
});

test('adds and syncs contacts with another device', (done) => {
  multidevice(({ android, alice, bob }) => {
    done();
  });
});

test('editMoniker syncs between two devices', (done) => {
  multidevice(async ({ android, alice, bob }) => {
    let newBobName = 'this is really bob i promise';

    alice.once('CONTACT_LIST_SYNC', () => {
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
  });
});

test('editAvatar syncs between two devices', (done) => {
  multidevice(async ({ android, alice }) => {
    let newBobImage =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZIAAABSCAYAAAB+HVL6AAABqElEQVR4nO3YQW3DQBRF0YEQJoYSCIEQKAmEMAgkQzCE6app1ZWlu7ArnSPN/m2+rjRjAkAwjh4AwP8mJAAkQgJAIiQAJEICQCIkACRCAkAiJAAkQgJAIiQAJEICQCIkACRCAkAiJLDT+/2ez+dzvl6vuW3b0XPgNIQEdrher3OM8Xm32+3oSXAaQgI7/I7IGGNeLpejJ8FpCAns8DckYzgd+OYaYIe/X1tCAj9cA+ywbdtcluUTkWVZjp4EpyEksNO6rvPxeMz7/T7XdT16DpyGkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQCAkAiZAAkAgJAImQAJAICQCJkACQfAGg2eAA/gk6awAAAABJRU5ErkJggg==';

    alice.once('CONTACT_LIST_SYNC', () => {
      let b = android.db.getContactById(petbob_id);
      expect(b.avatar).toStrictEqual(newBobImage);

      let ba = alice.db.getContactById(petbob_id);
      expect(ba.avatar).toStrictEqual(newBobImage);
      let bb = alice.db.getContactById(petbob_id);
      expect(ba).toStrictEqual(bb);
      done();
    });

    await android.editAvatar(petbob_id, newBobImage);
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

  expect(alice.opened()).toBe(true);
  expect(bob.opened()).toBe(true);

  let docId = bob.db.getContactById(petalice_id).discoveryKey;
  let p = patched(bob, docId);
  await alice.sendMessage(outgoing.contact, outgoing.text);
  await p;

  let messages = bob.getMessagesByContactId(petalice_id);
  expect(messages.length).toBe(1);

  p = patched(alice, docId);
  await bob.sendMessage(response.contact, response.text);
  await p;

  docId = alice.db.getDocumentId(alice.db.getContactById(petbob_id));
  let alices = alice.getMessagesByContactId(petbob_id);
  expect(alices[0].text).toBe(outgoing.text);
  expect(alices[1].text).toBe(response.text);
  let bobs = bob.getMessagesByContactId(petalice_id);
  expect(alices).toStrictEqual(bobs);
});
