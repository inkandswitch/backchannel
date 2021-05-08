import { Database } from './db';
import crypto from 'crypto';

let db;
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
  let id = db.addContact({
    moniker: 'bob',
    key: crypto.randomBytes(32),
  });

  let contact = db.getContactById(id);
  expect(contact.moniker).toBe('bob');
});

test('listContacts', async () => {
  let bob_id = db.addContact({
    moniker: 'bob',
    key: crypto.randomBytes(32).toString('hex'),
  });

  let alice_id = db.addContact({
    moniker: 'alice',
    key: crypto.randomBytes(32).toString('hex'),
  });

  expect(typeof bob_id).toBe('string');
  expect(typeof alice_id).toBe('string');

  let bob = db.getContactById(bob_id);

  let alice = db.getContactById(alice_id);

  let contacts = db.listContacts();
  expect(contacts.length).toBe(2);
  let sorted = contacts.sort((a, b) => a.moniker > b.moniker);
  expect(sorted[0]).toBe(bob);
  expect(sorted[1]).toBe(alice);
});

test('getContactByDiscoveryKey', () => {
  let bob_id = db.addContact({
    moniker: 'bob',
    key: crypto.randomBytes(32).toString('hex'),
  });

  let bob = db.getContactById(bob_id);

  let maybe_bob = db.getContactByDiscoveryKey(bob.discoveryKey);
  expect(maybe_bob).toBe(bob);
});

test('getContactByDiscoveryKey', () => {
  let bob_id = db.addContact({
    moniker: 'bob',
    key: crypto.randomBytes(32).toString('hex'),
  });

  let bob = db.getContactById(bob_id);

  let maybe_bob = db.getContactByDiscoveryKey(bob.discoveryKey);
  expect(maybe_bob).toBe(bob);
});

test('getMessagesByContactId', () => {
  let alice_id = db.addContact({
    moniker: 'alice',
    key: crypto.randomBytes(32).toString('hex'),
  });

  let msgs = [
    {
      incoming: false,
      text: 'hey .... whats up',
      contact: alice_id,
      timestamp: new Date().toString(),
    },
    {
      incoming: false,
      text: 'h4x the planet',
      contact: alice_id,
      timestamp: new Date().toString(),
    },
    {
      incoming: true,
      text: 'ok bob',
      contact: alice_id,
      timestamp: new Date().toString(),
    },
  ];

  msgs.map((msg) => db.addMessage(msg));

  let messages = db.getMessagesByContactId(alice_id);
  expect(messages.length).toBe(msgs.length);
});

test('editMoniker', () => {
  let bob_id = db.addContact({
    moniker: 'bob',
    key: crypto.randomBytes(32).toString('hex'),
  });

  let bob = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');

  db.editMoniker(bob.id, 'karen');
  let karen = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');
  expect(karen.moniker).toBe('karen');
});

test('save/load', (done) => {
  let bob_id = db.addContact({
    moniker: 'bob',
    key: crypto.randomBytes(32).toString('hex'),
  });

  let bob = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');

  db.editMoniker(bob.id, 'karen');
  let karen = db.getContactById(bob_id);
  expect(bob.moniker).toBe('bob');
  expect(karen.moniker).toBe('karen');

  db.save();
  db = null;

  db = new Database(dbname);
  db.on('open', async () => {
    let maybe_karen = db.getContactById(bob_id);
    expect(maybe_karen).toStrictEqual(karen);
    done();
  });
});
