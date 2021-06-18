/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

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
  Toggle,
  ToggleWrapper,
} from '../components';
import { Key, Code, ContactId } from '../backend/types';
import { color } from '../components/tokens';
import { ReactComponent as Copy } from './icons/Copy.svg';
import { ReactComponent as People } from './icons/People.svg';
import Backchannel from '../backend';

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;
// Amount of seconds the user has to share code before it regenerates
const CODE_REGENERATE_TIMER_SEC = 60;

type CodeViewMode = 'redeem' | 'generate';
type CodeType = 'words' | 'numbers' | 'qrCode';
let backchannel = Backchannel();

type Props = {
  view: CodeViewMode;
  object: string;
};

export default function AddContact({ view, object }: Props) {
  let [code, setCode] = useState<Code>('');
  let [codeType, setCodeType] = useState<CodeType>('words');
  let previousCodeType = usePrevious(codeType);
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [timeRemaining, resetTimer] = useCountdown(CODE_REGENERATE_TIMER_SEC);
  //eslint-disable-next-line
  let [location, setLocation] = useLocation();

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

  // Generate a new code and wait for other party to enter the code.
  let generateCode = useCallback(async () => {
    // Clear the code before getting a new one so
    // stale codes don't linger
    setCode('');
    try {
      let code: Code;
      switch (codeType) {
        case 'words':
          code = await backchannel.getCode();
          break;
        case 'numbers':
          code = await backchannel.getNumericCode();
          break;
      }

      if (code) {
        setCode(code);
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
      if (err.message.startsWith('This code has expired')) {
        // TODO differentiate between an actual backend err (which should be displayed) vs the code timing out (which should happen quietly).
      } else {
        console.error('got error from backend', err);
      }
    }
  }, [codeType, setLocation]);

  // generate new code and reset countdown when timer runs out
  useEffect(() => {
    if (view === 'generate' && timeRemaining === 0) {
      generateCode();
      resetTimer();
    }
  }, [timeRemaining, generateCode, resetTimer, view]);

  // generate new code and reset countdown when the code type changes
  // (including on initial page load)
  useEffect(() => {
    if (view === 'generate' && previousCodeType !== codeType) {
      generateCode();
      resetTimer();
    }
  }, [codeType, generateCode, view, previousCodeType, resetTimer]);

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
        setCode('');
      }
    },
    [isConnecting, object, setLocation]
  );

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

  async function onClickShareURL() {
    let url = `${window.location.origin}/redeem/contact#${code}`;
    if (sharable) {
      navigator
        .share({
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
        {view === 'generate' && (
          <ToggleWrapper>
            <Toggle
              onClick={() => setCodeType('words')}
              isActive={codeType === 'words'}
            >
              Via text
            </Toggle>
            <Toggle
              onClick={() => setCodeType('numbers')}
              isActive={codeType === 'numbers'}
            >
              On a Call
            </Toggle>
          </ToggleWrapper>
        )}
        {view === 'redeem' && (
          <ToggleWrapper>
            <Toggle isActive>Enter invite</Toggle>
          </ToggleWrapper>
        )}
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
                onClick={onClickCopy}
                css={css`
                  margin: 24px;
                  width: 100%;
                  position: relative;
                `}
              >
                <Copy
                  css={css`
                    margin: 0 8px;
                    position: absolute;
                    left: 0;
                  `}
                />
                Copy invite
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
                disabled={code.length === 0}
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
    <Button
      css={css`
        width: 100%;
        position: relative;
      `}
      {...props}
    >
      <People
        css={css`
          margin: 0 8px;
          position: absolute;
          left: 0;
        `}
      />
      Add contact
    </Button>
  );
}

// Counts down the seconds starting from `durationSec` to 0.
function useCountdown(
  durationSec: number
): [timeRemaining: number, resetTimer: () => void] {
  const [timeRemaining, setTimeRemaining] = useState<number>(durationSec);

  useEffect(() => {
    const timerID = setInterval(() => {
      if (timeRemaining !== 0) {
        // Count down by one second if the timer is not already at 0
        setTimeRemaining((sec) => sec - 1);
      }
    }, 1000);

    return () => clearInterval(timerID);
  }, [timeRemaining, durationSec]);

  return [timeRemaining, () => setTimeRemaining(durationSec)];
}

function usePrevious(value) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef();
  // Store current value in ref
  useEffect(() => {
    ref.current = value;
  }, [value]); // Only re-run if value changes
  // Return previous value (happens before update in useEffect above)
  return ref.current;
}
