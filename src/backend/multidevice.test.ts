import Multidevice from './multidevice';
import { Database } from './db';
import crypto from 'crypto';
import through from 'through2';

let a, b;
let dbname;

beforeEach((done) => {
  dbname = crypto.randomBytes(16);
  a = new Database(dbname + 'a');
  b = new Database(dbname + 'b');
  a.on('open', () => {
    b.on('open', () => {
      done();
    });
  });
});

afterEach(() => {
  a.destroy();
  b.destroy();
});

test('basic', async () => {
  let m_a = new Multidevice(a);
  let m_b = new Multidevice(b);
  let key = Buffer.from(crypto.randomBytes(32));

  let disco_a = m_a.add(key);
  let disco_b = m_b.add(key);

  expect(disco_b).toBe(disco_a);

  let socket = through();

  await m_a.sync(socket, disco_a);
  await m_b.sync(socket, disco_b);
});
