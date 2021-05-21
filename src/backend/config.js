const PROD = 'wss://attractive-moored-actor.glitch.me/';
const LOCAL = 'ws://localhost:3001';

const config = {
  RELAY_URL: process.env.NODE_ENV === 'production' ? PROD : LOCAL,
};
console.log(config.RELAY_URL);

export default config;
