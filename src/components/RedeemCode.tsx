/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import { UnderlineInput, Toggle, ToggleWrapper, IconButton } from '.';
import CodeView, {
  AnimationMode,
  codeViewAnimation,
  useAnimation,
} from './CodeView';
import { Key, ContactId } from '../backend/types';
import QRReader from './QRReader';
import { ReactComponent as People } from './icons/People.svg';
import Backchannel from '../backend';

let backchannel = Backchannel();

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;

enum Tab {
  INPUT,
  SCAN,
}

type Props = {
  object: string;
};

export default function RedeemCode({ object }: Props) {
  let [code, setCode] = useState('');

  let [tab, setTab] = useState<Tab>(Tab.INPUT);
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [animationMode, setAnimationMode] = useAnimation();

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

  let redeemCode = useCallback(
    async (code) => {
      const onError = (err: Error) => {
        console.error(err);
        setAnimationMode(AnimationMode.Connecting);
        setErrorMsg(err.message);
      };

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
    [animationMode, object, setRedirectUrl, setAnimationMode]
  );

  // attempt to redeem code if it's in the url hash
  useEffect(() => {
    let maybeCode = window.location.hash;
    if (maybeCode.length > 1 && code !== maybeCode) {
      redeemCode(maybeCode.slice(1));
    }
  }, [code, redeemCode]);

  function handleToggleClick(tab: Tab) {
    return () => {
      setTab(tab);
    };
  }

  function handleScanQRCode(value) {
    window.location.href = value;
  }

  function handleInputChange(event) {
    setErrorMsg('');
    setCode(event.target.value);
  }

  async function handleClickRedeem(e) {
    e.preventDefault();
    await redeemCode(code);
  }

  if (animationMode === AnimationMode.Redirect) {
    setLocation(redirectUrl);
  }

  if (animationMode !== AnimationMode.None) {
    return codeViewAnimation(animationMode);
  }

  return (
    <CodeView
      header={
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
      }
      instructions="Enter the invite you were given by the other party. You’ll be added as
      each other's contact."
      content={
        tab === Tab.SCAN ? (
          <QRReader onFind={handleScanQRCode} />
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
        )
      }
      message={errorMsg || message}
      footer={
        tab !== Tab.SCAN && (
          <IconButton
            onClick={handleClickRedeem}
            icon={People}
            form="code-input"
            type="submit"
            disabled={code.length === 0}
          >
            Add {object}
          </IconButton>
        )
      }
    />
  );
}
