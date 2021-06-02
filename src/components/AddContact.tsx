/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/react/macro';
import { Link, useLocation } from 'wouter';

import { copyToClipboard } from '../web';
import {
  Button,
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  UnderlineInput,
  Page,
  Spinner,
  IconWithMessage,
  TopBar,
} from '../components';
import { Key, Code, ContactId } from '../backend/types';
import { color } from '../components/tokens';
import { ReactComponent as EnterDoor } from './icons/EnterDoor.svg';
import Backchannel from '../backend';

// Amount of time to show immediate user feedback
let USER_FEEDBACK_TIMER = 5000;

type CodeViewMode = 'redeem' | 'generate';
let backchannel = Backchannel();

type Props = {
  view: CodeViewMode;
  object: string;
};

export default function AddContact({ view, object }: Props) {
  let [code, setCode] = useState<Code>('');
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  //eslint-disable-next-line
  let [location, setLocation] = useLocation();

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
    setIsConnecting(false)
    setErrorMsg(err.message);
  };

  function handleChange(event) {
    setErrorMsg('');
    setCode(event.target.value);
  }

  let generateCode = useCallback(async () => {
    try {
      const code: Code = await backchannel.getCode();

      if (code) {
        setCode(code);
        setErrorMsg('');
      }
    } catch (err) {
      onError(err);
      generateCode();
    }
  }, [])

  let redeemCode = useCallback(async (code) => {
    if (isConnecting) return
    try {
      setIsConnecting(true);
      let key: Key = await backchannel.accept(code);
      setIsConnecting(false);
      if (object === 'device') {
        let deviceId: ContactId = await backchannel.addDevice(key);
        setErrorMsg('');
        setLocation(`/device/${deviceId}`);
      } else {
        let cid: ContactId = await backchannel.addContact(key);
        setErrorMsg('');
        setLocation(`/contact/${cid}/add`);
      }
    } catch (err) {
      console.log('got error', err);
      onError(err);
      if (view === 'redeem') setCode('');
      else generateCode()
    }
  }, [generateCode, isConnecting, object, setLocation, view])

  useEffect(() => {
    // get code on initial page load
    if (view === 'generate' && !code && !errorMsg) {
      generateCode();
    }
    if (view === 'redeem') {
      let maybeCode = window.location.hash
      if (maybeCode.length > 1 && code !== maybeCode) {
        redeemCode(maybeCode.slice(1))
      }
    }
  }, [view, code, errorMsg, generateCode, redeemCode]);


  // Enter backchannel from 'input' code view
  async function onClickRedeem(e) {
    e.preventDefault();
    await redeemCode(code)
  }

  async function onClickShareURL() {
    let url = `${window.location.origin}/redeem/contact#${code}`
    if (navigator.share) {
      navigator.share({
        title: 'backchannel',
        text: 'lets talk on backchannel.',
        url,
      })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing', error));
    } else {
      const copySuccess = await copyToClipboard(url);
      if (copySuccess) {
        setMessage('Code copied!');
      }
    }
  }

  if (isConnecting && !errorMsg) {
    return (
      <Page>
        <TopBar />
        <ContentWithTopNav
          css={css`
            background: ${color.codeShareBackground};
            text-align: center;
          `}
        >
            {view === 'generate' && (
              <React.Fragment>
                <Instructions>
                  Share this code with a correspondant you trust to open a
                  backchannel and add them as a contact:
                </Instructions>
                <CodeDisplayOrInput>
                  {code}
                  <Button
                    variant="transparent"
                    onClick={onClickShareURL}
                    css={css`
                      margin-top: 24px;
                    `}
                  >
                    Share code
                  </Button>
                </CodeDisplayOrInput>
                <BottomActions>
                  <IconWithMessage icon={Spinner} text="Waiting for other side" />
                </BottomActions>
              </React.Fragment>
            )}
            {view === 'redeem' && (
              <IconWithMessage icon={Spinner} text="Connecting" />
            )}
        </ContentWithTopNav>
      </Page>
    );
  }

  return (
    <Page>
      <TopBar>
        <div
          css={css`
            flex: 0 1 auto;
            background: ${color.codeShareToggleBackground};
            padding: 4px 0;
            border-radius: 24px;
          `}
        >
          <Toggle href={`/generate/${object}`} isActive={view === 'generate'}>
            My code
          </Toggle>
          <Toggle href={`/redeem/${object}`} isActive={view === 'redeem'}>
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
              <Message>{errorMsg}</Message>
            </CodeDisplayOrInput>
            <BottomActions>
              <Message>{message}</Message>

              <Button
                variant="transparent"
                onClick={onClickShareURL}
                css={css`
                  margin: 24px;
                  width: 100%;
                `}
              >
                Share code
              </Button>
              <EnterBackchannelButton onClick={onClickRedeem} />
            </BottomActions>
          </React.Fragment>
        )}
        {view === 'redeem' && (
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
