import React from 'react';
import { render } from 'react-dom';
import App from './App';

declare global {
  interface Window { 
    spake2: any
  }
}

function onError (err: Error) {
  console.error("Connection error")
  console.error(err)
}

console.log('hello world')
var el = document.createElement('div')
el.setAttribute('id', 'root')
document.body.appendChild(el)

render(
  <App />, 
  document.getElementById('root')
);
