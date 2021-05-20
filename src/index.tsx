import React from 'react';
import { render } from 'react-dom';
import App from './App';
import reportWebVitals from './reportWebVitals';
import Backchannel from './backend';

let backchannel = Backchannel();

declare global {
  interface Window {
    spake2: any;
  }
}

localStorage.setItem('debug', 'bc:*')

// TODO: Loading screen
backchannel.on('open', () => {
  render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
});
reportWebVitals();
