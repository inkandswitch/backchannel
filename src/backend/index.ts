import { Mailbox, Backchannel, BackchannelSettings } from './backchannel';
import defaultConfig from './config';
import { Database } from './db';

let instance = null;

export default function initialize(
  _dbName?: string,
  config?: BackchannelSettings
): Backchannel {
  if (instance) return instance;
  let dbName = _dbName || 'backchannel_' + window.location.hash;
  let db = new Database<Mailbox>(dbName);
  instance = new Backchannel(db, config || defaultConfig);
  instance.on('error', function onError(err: Error) {
    console.error('Connection error');
    console.error(err);
  });

  return instance;
}
