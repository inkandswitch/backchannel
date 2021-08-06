import { Backchannel, BackchannelSettings } from './backchannel';
import defaultConfig from './config';
export { ERROR, EVENTS } from './backchannel';
export * from './types';
export * from './blobs';

let instance = null;

export default function initialize(
  _dbName?: string,
  config?: BackchannelSettings
): Backchannel {
  if (instance) return instance;
  let dbName = _dbName || 'backchannel_' + window.location.hash;
  instance = new Backchannel(dbName, config || defaultConfig);
  instance.on('error', function onError(err: Error) {
    console.error('Connection error');
    console.error(err);
  });

  instance.on('close', () => {
    console.error('close');
    instance = null;
  });

  return instance;
}
