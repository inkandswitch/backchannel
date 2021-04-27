import React from 'react';
import { render } from 'react-dom';
import App from './App';
import { Backchannel } from './backchannel';

declare global {
  interface Window {
    spake2: any;
  }
}

function onError(err: Error) {
  console.error('Connection error');
  console.error(err);
}

render(<App />, document.getElementById('root'));
