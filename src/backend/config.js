const PROD = 'ws://attractive-moored-actor.glitch.me/';
const LOCAL = 'ws://localhost:3001';

const config = {
  relay: process.env.NODE_ENV === 'production' ? PROD : LOCAL,
};

export default config;
