import Backchannel, { EVENTS } from '.';
import randomBytes from 'randombytes';

let doc,
  petbob_id,
  android_id,
  petalice_id = null;
let alice: Backchannel, bob: Backchannel, android: Backchannel;
let server,
  port = 3001;
let relay = `ws://localhost:${port}`;

function createDevice(name?: string): Backchannel {
  let dbname = name || randomBytes(16).toString('hex');
  return new Backchannel(dbname, { relay });
}

test.skip('generate a key', (end) => {
  // skipping this test because jest does not support wasm at this time
  alice = createDevice();
  bob = createDevice();

  alice.once(EVENTS.OPEN, () => {
    bob.once(EVENTS.OPEN, () => {
      let code = 'pineapple sausage';
      let pending = 2;
      let done = (key) => {
        console.log(key);
        pending--;
        if (pending === 0) end();
      };
      alice.accept('mailbox', code).then(done);
      bob.accept('mailbox', code).then(done);
    });
  });
});
