/** @jsxImportSource @emotion/react */
import React from 'react';
import { Route } from 'wouter';
import { css } from '@emotion/react/macro';

import { color } from './components/tokens';
import Mailbox from './components/Mailbox';
import ContactList from './components/ContactList';
import Contact from './components/Contact';
import AddContact from './components/AddContact';
import NetworkError from './components/Error';
import Settings, {
  ClearAllSettings,
  RelaySettings,
} from './components/Settings';

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
      <Route path="/redeem">
        <AddContact view={'redeem'} />
      </Route>
      <Route path="/generate">
        <AddContact view={'generate'} />
      </Route>
      <Route path="/settings/reset">
        <ClearAllSettings />
      </Route>
      <Route path="/settings/relay">
        <RelaySettings />
      </Route>
      <Route path="/settings">
        <Settings />
      </Route>
      <Route path="/mailbox/:cid">
        {(params) => <Mailbox contactId={params.cid} />}
      </Route>
      <Route path="/contact/:cid/add">
        {(params) => <Contact contactId={params.cid} />}
      </Route>
      <Route path="/">
        <ContactList />
      </Route>
      <NetworkError />
    </div>
  );
}
