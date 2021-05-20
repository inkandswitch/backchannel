/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import { css } from '@emotion/react/macro';
import { Link, useLocation } from 'wouter';

import { copyToClipboard } from '../web';
import { A, TopBar, Button, ContentWithTopNav } from '../components';
import { ReactComponent as ArrowLeft } from '../components/icons/ArrowLeft.svg';
import { Code, ContactId } from '../backend/types';
import { color, fontSize } from '../components/tokens';

// Amount of time to show immediate user feedback
let USER_FEEDBACK_TIMER = 5000;

type CodeViewMode = 'add' | 'generate';

export default ({ backchannel, view }: { backchannel; view: CodeViewMode }) => {
  let [code, setCode] = useState<Code>('');
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  //eslint-disable-next-line
  let [_, setLocation] = useLocation();

  useEffect(() => {
    // get code on initial page load
    if (!code) {
      onClickGenerate();
    }
  });

  // Set user feedback message to disappear if necessary
  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => {
        setMessage('');
      }, USER_FEEDBACK_TIMER);

      return () => clearTimeout(timeout);
    }
  }, [message]);

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
      setLocation(`/mailbox/${cid}`);
    } catch (err) {
      onError(err);
    }
  }

  async function onClickGenerate() {
    setErrorMsg('');

    try {
      const code: Code = await backchannel.getCode();

      if (code) {
        setCode(code);

        // This promise returns once the other party redeems the code
        let cid: ContactId = await backchannel.announce(code);
        setLocation(`/mailbox/${cid}`);
      }
    } catch (err) {
      onError(err);
    }
  }

  async function onClickCopy() {
    const copySuccess = await copyToClipboard(code);
    if (copySuccess) {
      setMessage('Code copied!');
    }
  }

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100vh;
      `}
    >
      <TopBar>
        <Link href="/">
          <ArrowLeft
            css={css`
              cursor: pointer;
            `}
          />
        </Link>
        <div
          css={css`
            flex: 1 0 auto;
          `}
        >
          <A href="generate">Generate codes</A>
          <A href="add">Enter codes</A>
        </div>
      </TopBar>
      <ContentWithTopNav
        css={css`
          background: ${color.codeShareBackground};
          text-align: center;
          display: flex;
          flex-direction: column;
        `}
      >
        <div>{errorMsg}</div>
        {view === 'generate' && (
          <React.Fragment>
            <Instructions>
              Share this code with a correspondant you trust to open a
              backchannel and add them as a contact:
            </Instructions>
            <CodeDisplayOrEntry>{code}</CodeDisplayOrEntry>
            <BottomActions>
              <div
                css={css`
                  margin: 16px 0;
                  word-break: break-word;
                  color: ${color.textBold};
                  height: 18px;
                `}
              >
                {message}
              </div>
              <Button onClick={onClickCopy}>Copy code</Button>
            </BottomActions>
          </React.Fragment>
        )}
        {view === 'add' && (
          <React.Fragment>
            <Instructions>
              Enter the code your correspondant sent you to access the
              backchannel:
            </Instructions>
            <CodeDisplayOrEntry>
              <input
                css={css`
                  font-size: inherit;
                  width: 100%;
                  text-align: center;
                `}
                type="text"
                placeholder="Enter the code"
                onChange={handleChange}
              ></input>
            </CodeDisplayOrEntry>
            <BottomActions>
              <Button onClick={onClickRedeem}>Enter Backchannel</Button>
            </BottomActions>
          </React.Fragment>
        )}
      </ContentWithTopNav>
    </div>
  );
};

const Instructions = (props) => (
  <div
    css={css`
      color: ${color.chatSecondaryText};
      font-size: ${fontSize[1]}px;
      margin: 18px 18px 0;
      flex: 0 0 auto;
    `}
    {...props}
  />
);

const CodeDisplayOrEntry = (props) => (
  <div
    css={css`
      color: ${color.textBold};
      font-size: ${fontSize[3]}px;
      font-family: monospace;
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin: 18px;
    `}
    {...props}
  />
);

const BottomActions = (props) => (
  <div
    css={css`
      align-self: center;
      margin-bottom: 18px;
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
    `}
    {...props}
  />
);
