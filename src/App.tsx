// this comment tells babel to convert jsx to calls to a function called jsx instead of React.createElement
// it makes emotion work
/** @jsx jsx */
import React, { useState } from 'react';
import { jsx, css } from '@emotion/react';
import { Link, Route } from 'wouter';

import { Backchannel, Contact } from './backchannel';
import { copyToClipboard } from './web';
import { ContactId } from './db';

let dbName = 'backchannel_' + window.location.hash;
console.log(dbName);
let backchannel = new Backchannel(dbName);

// Amount of time to show immediate user feedback
let USER_FEEDBACK_TIMER = 5000;

type CodeViewMode = 'add' | 'generate';

const CodeView = ({ view }: { view: CodeViewMode }) => {
  let [code, setCode] = useState('');
  let [key, setKey] = useState('');
  let [message, _setMessage] = useState('');
  let [messageTimeoutID, setMessageTimeoutID] = useState(null);
  let [errorMsg, setErrorMsg] = useState('');
  let [contact, setContact] = useState(null);

  let onError = (err: Error) => {
    console.error('got error from backend', err);
    setErrorMsg(err.message);
  };

  function handleChange(event) {
    setErrorMsg('');
    setCode(event.target.value);
  }

  async function onClickRedeem() {
    console.log('on click redeem');
    try {
      let cid: ContactId = await backchannel.accept(code);
      let contact = await backchannel.getContactById(cid);
      setErrorMsg('');
      clearMessage(messageTimeoutID);

      setContact(contact);
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
        setKey(code);

        // automatically copy to clipboad. TODO doesn't work on safari
        const copySuccess = await copyToClipboard(code);
        if (copySuccess) {
          setMessage('Code copied!'); // TODO this gets called multiple times?
        }

        // This promise returns once the other party redeems the code
        let cid: ContactId = await backchannel.announce(code);
        let contact = await backchannel.getContactById(cid);

        clearMessage(messageTimeoutID);
        setContact(contact);
        // contact.key is the strong key
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
              value={key}
              readOnly
            />
            {key ? (
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
      {contact && contact.key && (
        <div
          css={css`
            display: inline-block;
            margin: 16px 0;
            word-break: break-word;
          `}
        >
          Connection established at {contact.key}
        </div>
      )}
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

const A = ({ children, href, ...props }) => (
  <Link href={href} {...props}>
    <a
      css={css`
        display: inline-block;
        margin: 0 1em;
        background: white;
        color: black;
        text-decoration: none;
        padding: 2px 8px;
        border-radius: 5px;
      `}
    >
      {children}
    </a>
  </Link>
);
const Button = ({ children, ...props }) => (
  <button
    css={css`
      display: inline-block;
      margin: 0 1em;
      background: white;
      color: black;
      padding: 2px 8px;
      border-radius: 5px;
      font-size: inherit;
    `}
    {...props}
  >
    {children}
  </button>
);

const TopBar = (props) => (
  <div
    {...props}
    css={css`
      background: gray;
      text-align: center;
      padding: 16px 0;
    `}
  />
);

export default function App() {
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
      <Route path="/">
        <TopBar>
          <A href="add">Input code</A>
          <A href="generate">Generate code</A>
        </TopBar>
      </Route>
    </div>
  );
}
