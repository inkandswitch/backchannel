/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import {
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
  IconButton,
} from '.';
import { Key, ContactId } from '../backend/types';
import { color } from './tokens';
import QRReader from './QRReader';
import { ReactComponent as People } from './icons/People.svg';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import Backchannel from '../backend';

let backchannel = Backchannel();

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;

enum Tab {
  INPUT,
  SCAN,
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

export default function RedeemCode({ object }: Props) {
  let [tab, setTab] = useState<Tab>(Tab.INPUT);
  let [code, setCode] = useState('');
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [animationMode, setAnimationMode] = useState<AnimationMode>(
    AnimationMode.None
  );
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
    setAnimationMode(AnimationMode.Connecting);
    setErrorMsg(err.message);
  };

  function handleInputChange(event) {
    setErrorMsg('');
    setCode(event.target.value);
  }

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

  let redeemCode = useCallback(
    async (code) => {
      if (animationMode === AnimationMode.Connecting) return;
      try {
        setAnimationMode(AnimationMode.Connecting);
        let key: Key = await backchannel.accept(code);
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
          const timeoutId = setTimeout(() => {}, 2400);
          return () => clearTimeout(timeoutId);
        }
      } catch (err) {
        console.log('got error', err);
        onError(err);
        setCode('');
      }
    },
    [animationMode, object, setRedirectUrl]
  );

  // attempt to redeem code if it's in the url hash
  useEffect(() => {
    let maybeCode = window.location.hash;
    if (maybeCode.length > 1 && code !== maybeCode) {
      redeemCode(maybeCode.slice(1));
    }
  }, [code, redeemCode]);

  // Enter backchannel from 'input' code view
  async function onClickRedeem(e) {
    e.preventDefault();
    await redeemCode(code);
  }

  function onScanQRCode(value) {
    window.location.href = value;
  }

  function handleToggleClick(tab: Tab) {
    return () => {
      setTab(tab);
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
            onClick={handleToggleClick(Tab.INPUT)}
            isActive={tab === Tab.INPUT}
          >
            Enter Invite
          </Toggle>
          <Toggle
            onClick={handleToggleClick(Tab.SCAN)}
            isActive={tab === Tab.SCAN}
          >
            Scan Invite
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
        <Instructions>
          Enter the invite you were given by the other party. You’ll be added as
          each other's contact.
        </Instructions>
        <CodeDisplayOrInput>
          {tab === Tab.SCAN ? (
            <QRReader onFind={onScanQRCode} />
          ) : (
            <form id="code-input">
              <UnderlineInput
                value={code}
                css={css`
                  font-size: inherit;
                  width: 100%;
                  text-align: center;
                `}
                placeholder="Enter the code"
                onChange={handleInputChange}
                autoFocus
              />
            </form>
          )}
        </CodeDisplayOrInput>
        <BottomActions>
          <Message>{errorMsg || message}</Message>
          {tab !== Tab.SCAN && (
            <IconButton
              onClick={onClickRedeem}
              icon={People}
              form="code-input"
              type="submit"
              disabled={code.length === 0}
            >
              Add {object}
            </IconButton>
          )}
        </BottomActions>
      </ContentWithTopNav>
    </Page>
  );
}
