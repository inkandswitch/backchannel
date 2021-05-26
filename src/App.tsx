/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { Route } from 'wouter';
import { css } from '@emotion/react/macro';

import { color } from './components/tokens';
import { A, Button } from './components';
import Mailbox from './components/Mailbox';
import ContactList from './components/ContactList';
import Contact from './components/Contact';
import Devices from './components/Devices';
import AddContact from './components/AddContact';
import NetworkError from './components/Error';
import Backchannel from './backend';
import config from './backend/config';

import * as storage from './components/storage';

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
      <Route path="/add/:object">
        {(params) => (
          <AddContact
            view={'add'}
            backchannel={backchannel}
            object={params.object}
          />
        )}
      </Route>
      <Route path="/generate/:object">
        {(params) => (
          <AddContact
            view={'generate'}
            backchannel={backchannel}
            object={params.object}
          />
        )}
      </Route>
      <Route path="/settings">
        <Settings />
      </Route>
      <Route path="/device/:did">
        {(params) => <Devices deviceId={params.did} />}
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
  let [settings, setSettings] = useState(backchannel.settings);

  console.log('got settings', settings);
  function updateSettings(e) {
    e.preventDefault();
    console.log(e);
    let old = backchannel.settings;
    backchannel
      .updateSettings({ ...old, ...settings })
      .then((_) => {
        console.log('SUCCESS');
      })
      .catch((err) => {
        backchannel.updateSettings(old);
        console.error();
      });
  }

  function updateValues(e) {
    let name = e.target.name;
    let val = e.target.value;
    setSettings({ [name]: val });
  }

  function restoreDefault(e) {
    e.preventDefault();
    backchannel.updateSettings(config);
  }

  function clearDb() {
    // clean local storage state
    for (let key in storage.keys) {
      storage.remove(key);
    }

    backchannel
      .destroy()
      .then(() => {
        window.location.href = '/';
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
      <form onSubmit={updateSettings}>
        <div>
          <input
            name="relay"
            onChange={updateValues}
            type="text"
            defaultValue={settings.relay}
          ></input>
        </div>
        <div>
          <A href="/generate/device">Add Device</A>
          <Button onClick={clearDb}>ClearDB</Button>
          <br />
          <Button type="submit">Save</Button>
          <br />
          <Button onClick={restoreDefault}>Restore Defaults</Button>
        </div>
      </form>
    </div>
  );
}
