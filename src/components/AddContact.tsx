/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import { qrCode, copyToClipboard } from '../web';
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
  Toggle,
  ToggleWrapper,
} from '../components';
import { Key, Code, ContactId } from '../backend/types';
import { color } from '../components/tokens';
import { ReactComponent as EnterDoor } from './icons/EnterDoor.svg';
import Backchannel from '../backend';
import TimerDisplay from './TimerDisplay';

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;
// Amount of seconds the user has to share code before it regenerates
const CODE_REGENERATE_TIMER_SEC = 60;

type CodeViewMode = 'redeem' | 'generate';
let backchannel = Backchannel();

type Props = {
  view: CodeViewMode;
  object: string;
};

export default function AddContact({ view, object }: Props) {
  let [code, setCode] = useState<Code>('');
  let [QRCode, setQRCode] = useState<string>('');
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(
    CODE_REGENERATE_TIMER_SEC
  );
  //eslint-disable-next-line
  let [location, setLocation] = useLocation();
  //@ts-ignore
  let useNumbers = new URLSearchParams(window.location.search).get('numbers');

  let sharable = navigator.share;

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
    setIsConnecting(false);
    setErrorMsg(err.message);
  };

  function handleChange(event) {
    setErrorMsg('');
    setCode(event.target.value);
  }

  let generateCode = useCallback(async () => {
    try {
      const code: Code = useNumbers
        ? await backchannel.getNumericCode()
        : await backchannel.getCode();

      if (code) {
        let dataURL = await qrCode(getRedeemURL(code));
        setCode(code);
        setQRCode(dataURL);
        setErrorMsg('');
      }
      // automatically start the connection and wait for other person to show up.
      let key: Key = await backchannel.accept(
        code,
        (CODE_REGENERATE_TIMER_SEC + 2) * 1000 // be permissive, give extra time to redeem after timeout ends
      );
      let cid: ContactId = await backchannel.addContact(key);
      setErrorMsg('');
      setLocation(`/contact/${cid}/add`);
    } catch (err) {
      console.error('got error from backend', err);
      // TODO differentiate between an actual backend err (which should be displayed) vs the code timing out (which should happen quietly).
    }
  }, [useNumbers, setLocation]);

  // Decrement the timer, or restart it and generate a new code when it finishes.
  useEffect(() => {
    const timeout = setInterval(() => {
      setTimeRemainingSec((prevValue) =>
        prevValue === 0
          ? (generateCode(),
            console.log('generating code from timer'),
            CODE_REGENERATE_TIMER_SEC)
          : prevValue - 1
      );
    }, 1000);

    return () => clearInterval(timeout);
  }, [setTimeRemainingSec, generateCode]);

  async function onClickCopy() {
    const copySuccess = await copyToClipboard(code);
    if (copySuccess) {
      setMessage('Code copied!');
    }
  }

  let redeemCode = useCallback(
    async (code) => {
      if (isConnecting) return;
      try {
        setIsConnecting(true);
        let key: Key = await backchannel.accept(code);
        if (object === 'device') {
          let deviceId: ContactId = await backchannel.addDevice(key);
          setErrorMsg('');
          setIsConnecting(false);
          setLocation(`/device/${deviceId}`);
        } else {
          let cid: ContactId = await backchannel.addContact(key);
          setErrorMsg('');
          setIsConnecting(false);
          setLocation(`/contact/${cid}/add`);
        }
      } catch (err) {
        console.log('got error', err);
        onError(err);
        if (view === 'redeem') setCode('');
        else {
          console.log('generating code from redeemCode');
          generateCode();
        }
      }
    },
    [generateCode, isConnecting, object, setLocation, view]
  );

  // get code on initial page load
  useEffect(() => {
    if (view === 'generate' && !code) {
      console.log('generating code from initial pageload');
      generateCode();
    }
  }, [code, generateCode, view]);

  // attempt to redeem code if it's in the url hash
  useEffect(() => {
    if (view === 'redeem') {
      let maybeCode = window.location.hash;
      if (maybeCode.length > 1 && code !== maybeCode) {
        redeemCode(maybeCode.slice(1));
      }
    }
  }, [view, code, redeemCode]);

  // Enter backchannel from 'input' code view
  async function onClickRedeem(e) {
    e.preventDefault();
    await redeemCode(code);
  }

  function getRedeemURL(code) {
    return `${window.location.origin}/redeem/contact#${code}`;
  }

  async function onClickShareURL() {
    let url = getRedeemURL(code);
    if (sharable) {
      navigator
        .share({
          title: 'backchannel',
          text: 'lets talk on backchannel, the code is ' + code,
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

  if (isConnecting && !errorMsg.length) {
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
                  onClick={onClickCopy}
                  css={css`
                    margin-top: 24px;
                  `}
                >
                  Copy code
                </Button>
                {sharable && (
                  <Button
                    variant="transparent"
                    onClick={onClickShareURL}
                    css={css`
                      margin-top: 24px;
                    `}
                  >
                    Share
                  </Button>
                )}
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
        <ToggleWrapper>
          <Toggle href={`/generate/${object}`} isActive={view === 'generate'}>
            My code
          </Toggle>
          <Toggle href={`/redeem/${object}`} isActive={view === 'redeem'}>
            Enter code
          </Toggle>
        </ToggleWrapper>
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
              {code ? <img src={QRCode} alt="qr code"></img> : <Spinner />}
              <Message>{errorMsg}</Message>
            </CodeDisplayOrInput>
            <BottomActions>
              <Message>{message}</Message>

              <Button
                variant="transparent"
                onClick={onClickCopy}
                css={css`
                  margin: 24px;
                  width: 100%;
                `}
              >
                <div
                  css={css`
                    margin: 0 8px;
                  `}
                >
                  <TimerDisplay
                    totalTimeSec={CODE_REGENERATE_TIMER_SEC}
                    timeRemainingSec={timeRemainingSec}
                  />
                </div>
                Copy code
              </Button>

              {sharable && (
                <Button
                  variant="transparent"
                  onClick={onClickShareURL}
                  css={css`
                    margin-bottom: 24px;
                    width: 100%;
                  `}
                >
                  Share
                </Button>
              )}
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
