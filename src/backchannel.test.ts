import { Backchannel, EVENTS } from './backchannel';
import { generateKey } from './crypto';
import { randomBytes } from 'crypto';

let doc,
  petbob_id,
  android_id,
  petalice_id = null;
let alice, bob, android: Backchannel;
let server,
  port = 3001;
let relay = `ws://localhost:${port}`;

async function connected(device: Backchannel, id: string) {
  let p = new Promise<any>((resolve) => {
    device.once(EVENTS.CONTACT_CONNECTED, async (payload) => {
      if (payload.contact.id === id) resolve(payload);
    });
  });
  device.connectToContactId(id);
  return p;
}

async function onmessage(device, id) {
  return new Promise<any>((resolve) => {
    let onPatch = async ({ contactId, docId }) => {
      if (docId === id) {
        device.removeListener(EVENTS.MESSAGE, onPatch);
        resolve(contactId);
      }
    };
    device.on(EVENTS.MESSAGE, onPatch);
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

      let messages = await android.getMessagesByContactId(alices_bob.id);
      expect(messages).toStrictEqual([]);

      let msgText = 'hey alice';
      let docId = synced_bob.discoveryKey;
      let allPatched = Promise.all([
        onmessage(android, docId),
        onmessage(alice, docId),
      ]);
      await bob.sendMessage(petalice_id, msgText);

      await allPatched;
      let msgs = await android.getMessagesByContactId(alices_bob.id);
      let og = await alice.getMessagesByContactId(alices_bob.id);
      expect(msgs).toStrictEqual(og);

      done({
        android,
        alice,
        bob,
      });
    }

    android.once(EVENTS.RELAY_CONNECT, async () => {
      let _android_id = await alice.addDevice(key);
      let _alice_id = await android.addDevice(key);

      android_id = _android_id;
      let done = false;

      let cb = () => {
        if (done) return;
        if (android.contacts.length === alice.contacts.length) {
          done = true;
          onSync();
        }
      };
      android.on(EVENTS.CONTACT_LIST_SYNC, cb);
      alice.on(EVENTS.CONTACT_LIST_SYNC, cb);
      android.connectToContactId(_alice_id);
      alice.connectToContactId(_android_id);
    });
  });
}

function createDevice(name?: string): Backchannel {
  let dbname = name || randomBytes(16).toString('hex');
  return new Backchannel(dbname, { relay }, null);
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

    alice.once(EVENTS.OPEN, () => {
      bob.once(EVENTS.OPEN, () => {
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
  let messages = await bob.getMessagesByContactId(petalice_id);
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

  let docId = bob.db.getContactById(petalice_id).discoveryKey;
  let p = onmessage(bob, docId);
  await alice.sendMessage(outgoing.contact, outgoing.text);
  await p;
  let messages = await bob.getMessagesByContactId(petalice_id);
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
  alice.once(EVENTS.CONTACT_DISCONNECTED, onDisconnect);
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

    alice.once(EVENTS.CONTACT_LIST_SYNC, () => {
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
  let p = onmessage(bob, docId);
  await alice.sendMessage(outgoing.contact, outgoing.text);
  await p;

  let messages = await bob.getMessagesByContactId(petalice_id);
  expect(messages.length).toBe(1);

  p = onmessage(alice, docId);
  await bob.sendMessage(response.contact, response.text);
  await p;

  docId = alice.db.getContactById(petbob_id).discoveryKey;
  let alices = await alice.getMessagesByContactId(petbob_id);
  expect(alices[0].text).toBe(outgoing.text);
  expect(alices[1].text).toBe(response.text);
  let bobs = await bob.getMessagesByContactId(petalice_id);
  expect(alices).toStrictEqual(bobs);
});

test('unlink device', (done) => {
  multidevice(({ android, alice, bob }) => {
    // oops, lost my android.
    alice.unlinkDevice().then((_) => {
      expect(alice.devices.length).toBe(0);
      done();
    });
  });
});

test('lost my device', (done) => {
  multidevice(({ android, alice, bob }) => {
    // oops, lost my android.

    let android_loaded = new Backchannel(android.db.dbname, { relay }, null);
    android_loaded.on(EVENTS.OPEN, () => {
      expect(android_loaded.devices.length).toBe(1);
      expect(android_loaded.contacts.length).toBe(1);
      android_loaded = null;
      alice.sendTombstone(android_id).then((_) => {
        let pending = 2;
        android.once(EVENTS.CLOSE, () => {
          pending--;
          if (pending > 0) return;
          check();
        });
        alice.once(EVENTS.ACK, ({ contactId }) => {
          expect(contactId).toBe(android_id);
          pending--;
          if (pending > 0) return;
          check();
        });

        let check = () => {
          expect(alice.devices.length).toBe(0);
          let android_loaded = new Backchannel(
            android.db.dbname,
            { relay },
            null
          );
          android_loaded.on(EVENTS.OPEN, () => {
            expect(android_loaded.devices.length).toBe(0);
            expect(android_loaded.contacts.length).toBe(0);
            done();
          });
        };
      });
    });
  });
});
