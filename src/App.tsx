/** @jsxImportSource @emotion/react */
import React from 'react';
import { Route } from 'wouter';
import { css } from '@emotion/react/macro';

import { color } from './components/tokens';
import { Button } from './components';
import Mailbox from './components/Mailbox';
import ContactList from './components/ContactList';
import Contact from './components/Contact';
import AddContact from './components/AddContact';
import Backchannel from './backend';
import NetworkError from './components/Error';

let backchannel = Backchannel();

export default function App() {
  return (
    <div
      css={css`
        background: ${color.primary};
        max-width: 500px;
        max-height: min(130vw, 650px);
        height: 100%;
        margin: auto;
      `}
    >
      <Route path="/add">
        <AddContact view={'add'} backchannel={backchannel} />
      </Route>
      <Route path="/generate">
        <AddContact view={'generate'} backchannel={backchannel} />
      </Route>
      <Route path="/settings">
        <Settings />
      </Route>
      <Route path="/mailbox/:cid">
        {(params) => <Mailbox contactId={params.cid} />}
      </Route>
      <Route path="/contact/:cid/add">
        {(params) => (
          <Contact contactId={params.cid} backchannel={backchannel} />
        )}
      </Route>
      <Route path="/">
        <ContactList />
      </Route>
      <NetworkError />
    </div>
  );
}

/* placeholder */
function Settings(props) {
  function clearDb() {
    backchannel
      .destroy()
      .then(() => {
        console.log('cleared database! refresh.');
      })
      .catch((err) => {
        console.error('error clearing db', err);
      });
  }
  return (
    <div
      css={css`
        color: ${color.text};
        text-align: center;
        padding-top: 18px;
      `}
    >
      <p>Settings page will be here :D</p>
      <Button onClick={clearDb}>ClearDB</Button>
    </div>
  );
}
