import React from 'react';
import { render } from 'react-dom';
import App from './App';
import reportWebVitals from './reportWebVitals';

declare global {
  interface Window {
    spake2: any;
  }
}

render(
  <React.StrictMode>
    <App />,
  </React.StrictMode>,
  document.getElementById('root')
);

reportWebVitals();
