import { Database } from './db';
import crypto from 'crypto';
import Automerge from 'automerge';
import { Mailbox } from './backchannel';
import { TextMessage } from './types';

let db: Database<Mailbox>;
let dbname;

beforeEach((done) => {
  dbname = crypto.randomBytes(16);
  db = new Database(dbname);
  db.on('open', () => {
    done();
  });
});

afterEach(() => {
  db.destroy();
});

test('getContactById', async () => {
  let id = await db.addContact(crypto.randomBytes(32).toString('hex'), 'bob');

  let contact = db.getContactById(id);
  expect(contact.moniker).toBe('bob');
});

test('getContacts', async () => {
  let bob_id = await db.addContact(
    crypto.randomBytes(32).toString('hex'),
    'bob'
  );

  let alice_id = await db.addContact(
    crypto.randomBytes(32).toString('hex'),
    'alice'
  );

  expect(typeof bob_id).toBe('string');
  expect(typeof alice_id).toBe('string');

  let bob = db.getContactById(bob_id);
  let alice = db.getContactById(alice_id);

  let contacts = db.getContacts();
  expect(contacts.length).toBe(2);
  let sorted = contacts.sort((a, b) => (a.moniker > b.moniker ? 1 : 0));
  expect(sorted[0]).toStrictEqual(bob);
  expect(sorted[1]).toStrictEqual(alice);
});

test('getContactByDiscoveryKey', async () => {
  let bob_id = await db.addContact(
    crypto.randomBytes(32).toString('hex'),
    'bob'
  );

  let bob = db.getContactById(bob_id);
  let maybe_bob = db.getContactByDiscoveryKey(bob.discoveryKey);
  expect(maybe_bob).toStrictEqual(bob);
});

test('getContactByDiscoveryKey', async () => {
  let bob_id = await db.addContact(
    crypto.randomBytes(32).toString('hex'),
    'bob'
  );

  let bob = db.getContactById(bob_id);

  let maybe_bob = db.getContactByDiscoveryKey(bob.discoveryKey);
  expect(maybe_bob).toStrictEqual(bob);
});

test('editMoniker', async () => {
  let bob_id = await db.addContact(
    crypto.randomBytes(32).toString('hex'),
    'bob'
  );

  let bob = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');

  db.editMoniker(bob.id, 'karen');
  let karen = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');
  expect(karen.moniker).toBe('karen');
});

test('deleteContact', async () => {
  let bob_id = await db.addContact(
    crypto.randomBytes(32).toString('hex'),
    'bob'
  );

  let bob = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');

  await db.deleteContact(bob.id);

  expect(() => db.getContactById(bob_id)).toThrowError();
});

test('save/load', async () => {
  let bob_id = await db.addContact(
    crypto.randomBytes(32).toString('hex'),
    'bob'
  );

  let bob = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');

  await db.editMoniker(bob.id, 'bob2');
  let bob2 = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');
  expect(bob2.moniker).toBe('bob2');

  let docId = await db.addDocument(bob2, (doc: Mailbox) => {
    doc.messages = [
      {
        id: '523',
        target: bob.id,
        text: 'hello friend',
        timestamp: Date.now().toString(),
      } as TextMessage,
    ];
  });

  expect(db.documents).toStrictEqual([docId]);
  //@ts-ignore
  let doc: Automerge.Doc<Mailbox> = db.getDocument(docId);
  expect(doc.messages.length).toBe(1);
  //@ts-ignore
  expect(doc.messages[0].text).toBe('hello friend');

  db.change(docId, (doc: Mailbox) => {
    doc.messages.push({
      id: '525',
      target: bob.id,
      text: 'peanuts',
      timestamp: Date.now().toString(),
    } as TextMessage);
  });

  db = null;

  db = new Database(dbname);
  await db.open();
  let maybe_bob2 = db.getContactById(bob_id);
  expect(maybe_bob2).toStrictEqual(bob2);
  //@ts-ignore
  doc = db.getDocument(docId);
  expect(db.documents).toStrictEqual([docId]);
  expect(doc.messages.length).toBe(2);
  //@ts-ignore
  expect(doc.messages[0].text).toBe('hello friend');
});
