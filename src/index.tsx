import React from 'react';
import { render } from 'react-dom';
import App from './App';
import { RPC } from './wormhole';

declare global {
  interface Window { 
    wormhole: RPC; 
    spake2: any
  }
}

function onError (err: Error) {
  console.error("Connection error")
  console.error(err)
}

window.wormhole = window.wormhole || new RPC(onError)

console.log('hello world')
var el = document.createElement('div')
el.setAttribute('id', 'root')
document.body.appendChild(el)

render(
  <App />, 
  document.getElementById('root')
);
