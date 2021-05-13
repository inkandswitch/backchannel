/** @jsxImportSource @emotion/react */
import React from 'react';
import { Route } from 'wouter';

import { A, Button, TopBar } from './components';
import Mailbox from './components/Mailbox';
import ContactList from './components/ContactList';
import AddContact from './components/AddContact';
import Backchannel from './backend';

let backchannel = Backchannel();

export default function App() {
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
    <div>
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
        <TopBar>
          <A href="generate">Create new</A>
          <A href="add">Answer</A>
          <A href="">Contacts</A>
        </TopBar>
        <ContactList />
        <Button onClick={clearDb}>ClearDB</Button>
      </Route>
    </div>
  );
}
