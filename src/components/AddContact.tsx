/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import { css } from '@emotion/react/macro';
import { Link, useLocation } from 'wouter';

import { copyToClipboard } from '../web';
import {
  TopBar,
  Button,
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  BackToHomeLink,
  UnderlineInput,
  Page,
  Spinner,
  IconWithMessage,
  BackLink,
} from '../components';
import { Code, ContactId, Backchannel } from '../backend/types';
import { color } from '../components/tokens';
import { ReactComponent as EnterDoor } from './icons/EnterDoor.svg';

// Amount of time to show immediate user feedback
let USER_FEEDBACK_TIMER = 5000;

type CodeViewMode = 'input' | 'generate';
type Props = {
  view: CodeViewMode;
  backchannel: Backchannel;
};

export default function AddContact({ backchannel, view }: Props) {
  let [code, setCode] = useState<Code>('');
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  //eslint-disable-next-line
  let [_, setLocation] = useLocation();

  useEffect(() => {
    // get code on initial page load
    if (view === 'generate' && !code && !errorMsg) {
      generateCode();
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

  // Enter backchannel from 'input' code view
  async function onClickRedeem(e) {
    e.preventDefault();
    try {
      setIsConnecting(true);
      let cid: ContactId = await backchannel.accept(code);
      setIsConnecting(false);
      setErrorMsg('');
      setLocation(`/contact/${cid}/add`);
    } catch (err) {
      console.log('got error', err);
      onError(err);
      setCode('');
    }
  }

  // Enter backchannel from 'generate' code view
  async function onClickEnterBackchannel() {
    try {
      setIsConnecting(true);
      let cid: ContactId = await backchannel.accept(code);
      setIsConnecting(false);
      setErrorMsg('');
      setLocation(`/contact/${cid}/add`);
    } catch (err) {
      console.log('got error', err);
      onError(err);
      setCode('');
    }
  }

  async function generateCode() {
    try {
      const code: Code = await backchannel.getCode();

      if (code) {
        setCode(code);
        setErrorMsg('');
      }
    } catch (err) {
      onError(err);
      setCode('');
      generateCode();
    }
  }

  async function onClickCopy() {
    const copySuccess = await copyToClipboard(code);
    if (copySuccess) {
      setMessage('Code copied!');
    }
  }

  const handleBackClick = () => {
    setIsConnecting(false);
  };

  if (isConnecting && !errorMsg) {
    return (
      <Page>
        <TopBar>
          <BackLink onClick={handleBackClick} />
          <div
            css={css`
              flex: 0 1 auto;
            `}
          ></div>
          <div
            css={css`
              width: 50px;
            `}
          />
        </TopBar>
        <ContentWithTopNav
          css={css`
            background: ${color.codeShareBackground};
            text-align: center;
            display: flex;
            flex-direction: column;
          `}
        >
          <div
            css={css`
              font-size: 22px;
              font-weight: 200;
              display: flex;
              justify-content: center;
              flex-direction: column;
              align-items: center;
              letter-spacing: 1.1;
              margin: 2em 0;
            `}
          >
            {view === 'generate' && (
              <>
                <CodeDisplayOrInput>
                  {code}
                  <Button
                    variant="transparent"
                    onClick={onClickCopy}
                    css={css`
                      margin-top: 24px;
                    `}
                  >
                    Copy code
                  </Button>
                </CodeDisplayOrInput>
                <IconWithMessage icon={Spinner} text="Waiting for other side" />
              </>
            )}
            {view === 'input' && (
              <IconWithMessage icon={Spinner} text="Connecting" />
            )}
          </div>
        </ContentWithTopNav>
      </Page>
    );
  }

  return (
    <Page>
      <TopBar>
        <BackToHomeLink />
        <div
          css={css`
            flex: 0 1 auto;
            background: ${color.codeShareToggleBackground};
            padding: 4px 0;
            border-radius: 24px;
          `}
        >
          <Toggle href="generate" isActive={view === 'generate'}>
            Generate code
          </Toggle>
          <Toggle href="input" isActive={view === 'input'}>
            Enter code
          </Toggle>
        </div>
        <div
          css={css`
            width: 50px;
          `}
        />
      </TopBar>
      <ContentWithTopNav
        css={css`
          background: ${color.codeShareBackground};
          text-align: center;
          display: flex;
          flex-direction: column;
        `}
      >
        {view === 'generate' && (
          <React.Fragment>
            <Instructions>
              Share this code with a correspondant you trust to open a
              backchannel and add them as a contact:
            </Instructions>
            <CodeDisplayOrInput>
              {code ? code : <Spinner />}
              <Button
                variant="transparent"
                onClick={onClickCopy}
                css={css`
                  margin-top: 24px;
                `}
              >
                Copy code
              </Button>
            </CodeDisplayOrInput>
            <BottomActions>
              <Message>{errorMsg || message}</Message>
              <EnterBackchannelButton onClick={onClickEnterBackchannel} />
            </BottomActions>
          </React.Fragment>
        )}
        {view === 'input' && (
          <React.Fragment>
            <Instructions>
              Enter the code your correspondant sent you to access the
              backchannel:
            </Instructions>
            <CodeDisplayOrInput>
              <form id="code-input">
                <UnderlineInput
                  value={code}
                  css={css`
                    font-size: inherit;
                    width: 100%;
                    text-align: center;
                  `}
                  placeholder="Enter the code"
                  onChange={handleChange}
                  autoFocus
                />
              </form>
            </CodeDisplayOrInput>
            <BottomActions>
              <Message>{errorMsg || message}</Message>
              <EnterBackchannelButton
                onClick={onClickRedeem}
                type="submit"
                form="code-input"
              />
            </BottomActions>
          </React.Fragment>
        )}
      </ContentWithTopNav>
    </Page>
  );
}

type ToggleProps = {
  isActive: boolean;
} & React.ComponentProps<typeof Link>;

function Toggle({ isActive = false, ...props }: ToggleProps) {
  return (
    <Link
      css={css`
        display: inline-block;
        margin: 0 6px;
        text-decoration: none;
        padding: 8px 14px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
        color: ${
          isActive ? color.codeShareToggleTextActive : color.codeShareToggleText
        };
        background: ${
          isActive ? color.codeShareToggleBackgroundActive : 'none'
        };
        }
      `}
      {...props}
    />
  );
}

function EnterBackchannelButton(props) {
  return (
    <Button {...props}>
      <EnterDoor
        css={css`
          height: 22px;
        `}
      />
      Enter backchannel
    </Button>
  );
}
