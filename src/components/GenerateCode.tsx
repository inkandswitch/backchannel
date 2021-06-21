/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import useCode, { CodeType } from '../hooks/useCode';
import { copyToClipboard } from '../web';
import {
  Button,
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  Page,
  Spinner,
  IconWithMessage,
  TopBar,
  Toggle,
  ToggleWrapper,
  IconButton,
} from '.';
import { Key, ContactId } from '../backend/types';
import { color } from './tokens';
import { ReactComponent as Copy } from './icons/Copy.svg';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import Backchannel from '../backend';

let backchannel = Backchannel();

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;
// Amount of seconds the user has to share code before it regenerates
const CODE_REGENERATE_TIMER_SEC = 60;

enum Tab {
  WORDS = 'words',
  NUMBERS = 'numbers',
  QRCODE = 'qrcode',
}
enum AnimationMode {
  None = 0,
  Connecting = 1,
  Connected = 2,
  Redirecting = 3,
}

type Props = {
  object: string;
};

export default function GenerateCode({ object }: Props) {
  let [codeType, setCodeType] = useState<CodeType>(CodeType.WORDS);
  let [tab, setTab] = useState<Tab>(Tab.WORDS);
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  let [code, qrCode] = useCode(codeType, CODE_REGENERATE_TIMER_SEC);
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [animationMode, setAnimationMode] = useState<AnimationMode>(
    AnimationMode.None
  );
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
    setAnimationMode(AnimationMode.None);
    setErrorMsg(err.message);
  };

  // Generate a new code and wait for other party to enter the code.
  let redeemGeneratedCode = useCallback(
    async (code) => {
      try {
        let key: Key = await backchannel.accept(
          code,
          (CODE_REGENERATE_TIMER_SEC + 2) * 1000 // be permissive, give extra time to redeem after timeout ends
        );

        if (object === 'device') {
          let deviceId: ContactId = await backchannel.addDevice(key);
          setErrorMsg('');
          setAnimationMode(AnimationMode.Connected);
          setRedirectUrl(`/device/${deviceId}`);
        } else {
          let cid: ContactId = await backchannel.addContact(key);
          setErrorMsg('');
          setAnimationMode(AnimationMode.Connected);
          setRedirectUrl(`/contact/${cid}/add`);
        }
      } catch (err) {
        if (err.message.startsWith('This code has expired')) {
          // TODO differentiate between an actual backend err (which should be displayed) vs the code timing out (which should happen quietly).
        } else {
          onError(err);
        }
      }
    },
    [setRedirectUrl, object]
  );

  // join backchannel when code regenerates
  useEffect(() => {
    if (code.length > 0) {
      redeemGeneratedCode(code);
    }
  }, [code, redeemGeneratedCode]);

  // Move from one animation step to the next
  useEffect(() => {
    let timeoutId;
    switch (animationMode) {
      case AnimationMode.Connected:
        timeoutId = setTimeout(() => {
          setAnimationMode((mode) => mode + 1);
        }, 2000);
        return () => clearTimeout(timeoutId);
      case AnimationMode.Redirecting:
        timeoutId = setTimeout(() => {
          setLocation(redirectUrl);
        }, 3000);
        return () => clearTimeout(timeoutId);
    }
  }, [animationMode, redirectUrl, setLocation]);

  async function onClickCopy() {
    const copySuccess = await copyToClipboard(code);
    if (copySuccess) {
      setMessage('Code copied!');
    }
  }

  async function onClickShareURL() {
    let url = window.location.origin + '/redeem/contact';
    if (sharable) {
      navigator
        .share({
          title: 'Chat on backchannel',
          text: `I want to chat with you securely with you on Backchannel. Go to ${url} and use the following invitation code: 
          ${code}`,
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

  function handleToggleClick(tab: Tab, codeType?: CodeType) {
    return () => {
      setTab(tab);
      if (codeType) {
        setCodeType(codeType);
      }
    };
  }

  switch (animationMode) {
    case AnimationMode.Connecting:
      // Show connection loading page
      return (
        <Page>
          <TopBar />
          <ContentWithTopNav
            css={css`
              background: ${color.codeShareBackground};
            `}
          >
            <CodeDisplayOrInput>
              <IconWithMessage icon={Spinner} text="Connecting" />
            </CodeDisplayOrInput>
            <BottomActions
              css={css`
                height: 76px;
              `}
            />
          </ContentWithTopNav>
        </Page>
      );

    case AnimationMode.Connected:
      // Show successful connection message
      return (
        <Page>
          <TopBar />
          <ContentWithTopNav
            css={css`
              background: ${color.codeShareBackground};
            `}
          >
            <CodeDisplayOrInput>
              <IconWithMessage
                icon={Checkmark}
                text={`${
                  object === 'device' ? 'Device' : 'Correspondant'
                } found`}
              />
            </CodeDisplayOrInput>
            <BottomActions
              css={css`
                height: 76px;
              `}
            />
          </ContentWithTopNav>
        </Page>
      );
    case AnimationMode.Redirecting:
      // Redirect to the contact/device naming step
      return (
        <Page>
          <TopBar />
          <ContentWithTopNav
            css={css`
              background: ${color.codeShareBackground};
            `}
          >
            <CodeDisplayOrInput>
              <IconWithMessage icon={Spinner} text="Creating Secure Channel" />
            </CodeDisplayOrInput>
            <BottomActions
              css={css`
                height: 76px;
              `}
            />
          </ContentWithTopNav>
        </Page>
      );
  }

  return (
    <Page>
      <TopBar>
        <ToggleWrapper>
          <Toggle
            onClick={handleToggleClick(Tab.WORDS, CodeType.WORDS)}
            isActive={tab === Tab.WORDS}
          >
            Via text
          </Toggle>
          <Toggle
            onClick={handleToggleClick(Tab.NUMBERS, CodeType.NUMBERS)}
            isActive={tab === Tab.NUMBERS}
          >
            On a Call
          </Toggle>
          <Toggle
            onClick={handleToggleClick(Tab.QRCODE)}
            isActive={tab === Tab.QRCODE}
          >
            In person
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
        <React.Fragment>
          <Instructions>
            Share this temporary invite with the other party. Once used, you’ll
            be added as each other's contact.
          </Instructions>
          <CodeDisplayOrInput>
            {tab === Tab.QRCODE ? (
              <img src={qrCode} alt="Scan me with your camera" />
            ) : code ? (
              code
            ) : (
              <Spinner />
            )}
            <Message>{errorMsg}</Message>
          </CodeDisplayOrInput>
          <BottomActions>
            <Message>{message}</Message>
            {tab !== Tab.QRCODE && (
              <>
                <IconButton onClick={onClickCopy} icon={Copy}>
                  Copy invite
                </IconButton>
                {sharable && (
                  <Button
                    variant="transparent"
                    onClick={onClickShareURL}
                    css={css`
                      margin: 16px;
                      margin-bottom: 24px;
                    `}
                  >
                    Share
                  </Button>
                )}
              </>
            )}
          </BottomActions>
        </React.Fragment>
      </ContentWithTopNav>
    </Page>
  );
}
