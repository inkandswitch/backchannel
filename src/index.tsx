import React from 'react';
import { render } from 'react-dom';
import App from './App';
import reportWebVitals from './reportWebVitals';
import Backchannel from './backend';
import InstallButton from './components/InstallButton';
import { forceScreenSize } from './web';
import { viewport } from './components/tokens';

let backchannel = Backchannel();

declare global {
  interface Window {
    spake2: any;
  }
}

localStorage.setItem('debug', 'bc:*');

forceScreenSize(viewport.maxWidth, viewport.maxHeight);

// TODO: Loading screen
backchannel.once('open', async () => {
  render(
    //@ts-ignore
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
});

render(<InstallButton />, document.getElementById('install'));

reportWebVitals();
