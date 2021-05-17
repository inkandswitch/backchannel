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
window.addEventListener('beforeunload', function (event) {
  if (backchannel.opened()) {
    backchannel.db.save().then(() => {
      console.log('SAVED DB');
    });
  }
});

// TODO: Loading screen
backchannel.on('open', async () => {
  render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
});
reportWebVitals();
