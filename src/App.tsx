/** @jsxImportSource @emotion/react */
import React from 'react';
import { Route } from 'wouter';
import { css } from '@emotion/react/macro';

import { color } from './components/tokens';
import { A, Button, TopBar } from './components';
import Mailbox from './components/Mailbox';
import ContactList from './components/ContactList';
import AddContact from './components/AddContact';
import Backchannel from './backend';

let backchannel = Backchannel();

export default function App() {
  return (
    <div
      css={css`
        background: ${color.primary};
      `}
    >
      <Route path="/add">
        <AddContact view={'add'} backchannel={backchannel} />
      </Route>
      <Route path="/generate">
        <AddContact view={'generate'} backchannel={backchannel} />
      </Route>
      <Route path="/mailbox/:cid">
        {(params) => <Mailbox contactId={params.cid} />}
      </Route>
      <Route path="/">
        <ContactList />
      </Route>
    </div>
  );
}
