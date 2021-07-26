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
import { CodeType, Key, ContactId } from '../backend/types';
import QRReader from './QRReader';
import { ReactComponent as People } from './icons/People.svg';
import Backchannel from '../backend';

let backchannel = Backchannel();

enum Tab {
  INPUT,
  SCAN,
}

export default function RedeemCode() {
  let [code, setCode] = useState('');

  let [tab, setTab] = useState<Tab>(Tab.INPUT);
  let [errorMsg, setErrorMsg] = useState('');
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [animationMode, setAnimationMode] = useAnimation();

  //eslint-disable-next-line
  let [location, setLocation] = useLocation();

  let redeemCode = useCallback(
    async (code) => {
      const onError = (err: Error) => {
        console.error(err);
        setAnimationMode(AnimationMode.None);
        setErrorMsg(err.message);
      };
      if (animationMode === AnimationMode.Connecting) return;
      try {
        setAnimationMode(AnimationMode.Connecting);
        let codeType = backchannel.detectCodeType(code);

        if (codeType === CodeType.NUMBERS) {
          code = backchannel.numericCodeToWords(code);
        }
        let key: Key = await backchannel.accept(code, 5000);

        let cid: ContactId = await backchannel.addContact(key);
        setErrorMsg('');
        setAnimationMode(AnimationMode.Connected);
        setRedirectUrl(`/contact/${cid}/add`);
      } catch (err) {
        onError(err);
        setCode('');
      }
    },
    [animationMode, setRedirectUrl, setAnimationMode]
  );

  // attempt to redeem code if it's in the url hash
  useEffect(() => {
    let maybeCode = window.location.hash;
    if (maybeCode.length > 1 && code !== maybeCode) {
      // remove maybeCode from hash so it doesn't get retried
      window.history.pushState('', document.title, window.location.pathname);
      redeemCode(maybeCode.slice(1).replaceAll('-', ' '));
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
      message={errorMsg}
      footer={
        tab !== Tab.SCAN && (
          <IconButton
            onClick={handleClickRedeem}
            icon={People}
            form="code-input"
            type="submit"
            disabled={!backchannel.validCode(code)}
          >
            Add Contact
          </IconButton>
        )
      }
    />
  );
}
