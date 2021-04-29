import { Backchannel } from './backchannel';
import config from './config.json';
import { Database } from './db';

let instance = null;

export default function initialize(_dbName?: string, _relay?: string) {
  if (instance) return instance;
  let dbName = _dbName || 'backchannel_' + window.location.hash;
  let relay = _relay || config.RELAY_URL;
  console.log('connecting to relay', relay);
  let db = new Database(dbName);
  instance = new Backchannel(db, relay);
  instance.on('error', function onError(err: Error) {
    console.error('Connection error');
    console.error(err);
  });

  return instance;
}
