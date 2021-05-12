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

test('getContacts', async () => {
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

  let contacts = db.getContacts();
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
  db.save().then(() => {
    db = null;

    db = new Database(dbname);
    db.on('open', () => {
      let maybe_karen = db.getContactById(bob_id);
      expect(maybe_karen).toStrictEqual(karen);
      done();
    });
  });
});
