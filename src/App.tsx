// this comment tells babel to convert jsx to calls to a function called jsx instead of React.createElement
// it makes emotion work
/** @jsx jsx */
import React, { useState, useEffect } from 'react';
import { jsx, css } from '@emotion/react';
import { Link, Route, useLocation } from 'wouter';

import { copyToClipboard } from './web';
import { ContactId } from './db';
import { TopBar, A, Button } from './components';
import Mailbox from './components/Mailbox';
import ContactList from './components/ContactList';
import Backchannel from './backchannel';

let backchannel = Backchannel();

// Amount of time to show immediate user feedback
let USER_FEEDBACK_TIMER = 5000;

type CodeViewMode = 'add' | 'generate';

const CodeView = ({ view }: { view: CodeViewMode }) => {
  let [code, setCode] = useState('');
  let [message, _setMessage] = useState('');
  let [messageTimeoutID, setMessageTimeoutID] = useState(null);
  let [errorMsg, setErrorMsg] = useState('');
  let [contact, setContact] = useState(null);
  let [location, setLocation] = useLocation();

  let onError = (err: Error) => {
    console.error('got error from backend', err);
    setErrorMsg(err.message);
  };

  function handleChange(event) {
    setErrorMsg('');
    setCode(event.target.value);
  }

  async function onClickRedeem() {
    console.log('on click redeem', code);
    try {
      let cid: ContactId = await backchannel.accept(code);
      console.log('opening mailbox', cid);
      setErrorMsg('');
      clearMessage(messageTimeoutID);
      setLocation(`/mailbox/${cid}`);
    } catch (err) {
      onError(err);
    }
  }

  function clearMessage(id) {
    console.log('clearing', id);

    if (id) {
      clearTimeout(id);
    }
  }

  function setMessage(message: string) {
    clearMessage(messageTimeoutID); // TODO this doesn't clear, probably need to use useEffect

    // Set message to be displayed
    _setMessage(message);

    // Reset after a certain amount of time
    const timeoutID = setTimeout(() => {
      setMessage('');
    }, USER_FEEDBACK_TIMER);
    // Update new timeoutID
    console.log('new timeout id', timeoutID);

    setMessageTimeoutID(timeoutID);
  }

  async function onClickGenerate() {
    setErrorMsg('');

    try {
      const code = await backchannel.getCode();

      if (code) {
        setCode(code);

        // automatically copy to clipboad. TODO doesn't work on safari
        const copySuccess = await copyToClipboard(code);
        if (copySuccess) {
          setMessage('Code copied!'); // TODO this gets called multiple times?
        }

        // This promise returns once the other party redeems the code
        let cid: ContactId = await backchannel.announce(code);
        clearMessage(messageTimeoutID);
        setLocation(`/mailbox/${cid}`);
      }
    } catch (err) {
      onError(err);
    }
  }

  return (
    <div>
      <TopBar>
        {view === 'add' && (
          <React.Fragment>
            <input
              css={css`
                font-size: inherit;
                width: 10em;
              `}
              type="text"
              onChange={handleChange}
            ></input>
            <Button onClick={onClickRedeem}>Redeem</Button>
          </React.Fragment>
        )}
        {view === 'generate' && (
          <React.Fragment>
            <input
              css={css`
                font-size: inherit;
                width: 10em;
              `}
              value={code}
              readOnly
            />
            {code ? (
              <Button onClick={() => copyToClipboard(code)}>Copy</Button>
            ) : (
              <Button onClick={onClickGenerate}>Generate</Button>
            )}
          </React.Fragment>
        )}
        <Link href="/">
          <a
            css={css`
              color: white;
              padding-left: 8px;
              font-size: 0.8em;
            `}
          >
            Cancel
          </a>
        </Link>
      </TopBar>
      <div>{errorMsg}</div>
      {message && (
        <div
          css={css`
            display: inline-block;
            margin: 16px 0;
            word-break: break-word;
          `}
        >
          {message}
        </div>
      )}
    </div>
  );
};

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
    <div
      css={css`
        text-align: center;
      `}
    >
      <Route path="/add">
        <CodeView view={'add'} />
      </Route>
      <Route path="/generate">
        <CodeView view={'generate'} />
      </Route>
      <Route path="/mailbox/:cid">
        {(params) => <Mailbox contactId={parseInt(params.cid)} />}
      </Route>
      <Route path="/">
        <Button onClick={clearDb}>ClearDB</Button>
        <TopBar>
          <A href="add">Input code</A>
          <A href="generate">Generate code</A>
        </TopBar>
        <ContactList />
      </Route>
    </div>
  );
}
