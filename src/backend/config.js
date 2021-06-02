const PROD = 'wss://relay.okdistribute.xyz/';
const LOCAL = 'ws://localhost:3001';

const config = {
  relay: process.env.NODE_ENV === 'production' ? PROD : LOCAL,
};

export default config;
