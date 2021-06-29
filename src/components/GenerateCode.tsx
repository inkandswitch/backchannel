/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import useCode from '../hooks/useCode';
import { copyToClipboard } from '../web';
import { Spinner, Toggle, ToggleWrapper, IconButton } from '.';
import CodeView, {
  AnimationMode,
  codeViewAnimation,
  useAnimation,
} from './CodeView';
import { CodeType, Key, ContactId } from '../backend/types';
import { ReactComponent as Copy } from './icons/Copy.svg';
import Backchannel from '../backend';

let backchannel = Backchannel();

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;
// Amount of seconds the user has to share code before it regenerates
const CODE_REGENERATE_TIMER_SEC = 60;
const REDEEM_URL_PATH = '/redeem';

enum Tab {
  WORDS = 'words',
  NUMBERS = 'numbers',
  QRCODE = 'qrcode',
}

export default function GenerateCode() {
  let [codeType, setCodeType] = useState<CodeType>(CodeType.WORDS);
  let [code, qrCode] = useCode(
    codeType,
    CODE_REGENERATE_TIMER_SEC,
    REDEEM_URL_PATH
  );

  let [tab, setTab] = useState<Tab>(Tab.WORDS);
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [animationMode, setAnimationMode] = useAnimation();
  const [, setLocation] = useLocation();

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

  // Generate a new code and wait for other party to enter the code.
  let redeemGeneratedCode = useCallback(
    async (code) => {
      const onError = (err: Error) => {
        console.error('got error from backend', err);
        setAnimationMode(AnimationMode.None);
        setErrorMsg(err.message);
      };

      try {
        let key: Key = await backchannel.accept(
          code,
          (CODE_REGENERATE_TIMER_SEC + 2) * 1000 // be permissive, give extra time to redeem after timeout ends
        );

        let cid: ContactId = await backchannel.addContact(key);
        setErrorMsg('');
        setAnimationMode(AnimationMode.Connected);
        setRedirectUrl(`/contact/${cid}/add`);
      } catch (err) {
        if (err.message.startsWith('This code has expired')) {
          // TODO differentiate between an actual backend err (which should be displayed) vs the code timing out (which should happen quietly).
        } else {
          onError(err);
        }
      }
    },
    [setRedirectUrl, setAnimationMode]
  );

  // join backchannel when code regenerates
  useEffect(() => {
    if (code.length > 0) {
      redeemGeneratedCode(code);
    }
  }, [code, redeemGeneratedCode]);

  async function onClickCopy() {
    const copySuccess = await copyToClipboard(code);
    if (copySuccess) {
      setMessage('Code copied!');
    }
  }

  async function onClickShare() {
    let url = window.location.origin + REDEEM_URL_PATH;
    let text = `Want to chat securely on Backchannel? Go to ${url} and use the invitation code:

    ${code}
    `;
    if (sharable) {
      navigator
        .share({
          title: 'Backchannel invitation code',
          text: text,
        })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing', error));
    } else {
      onClickCopy();
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

  function formatCode(code: string, codeType: CodeType): string {
    if (codeType !== CodeType.NUMBERS) return code;
    let formatted = '';
    let spaces = [0, 3, 5, 7];
    for (var i = 0; i < code.length; i++) {
      formatted += `${code[i]}`;
      if (spaces.indexOf(i) > -1) {
        formatted += ' ';
      }
    }
    return formatted;
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
      }
      instructions="Share this temporary invite with the other party. Once used, you’ll
    be added as each other's contact."
      content={
        tab === Tab.QRCODE ? (
          <img src={qrCode} alt="Scan me with your camera" />
        ) : code ? (
          formatCode(code, codeType)
        ) : (
          <Spinner />
        )
      }
      message={errorMsg || message}
      footer={
        tab !== Tab.QRCODE && (
          <>
            <IconButton
              icon={Copy}
              onClick={onClickShare}
              css={css`
                margin: 16px;
                margin-bottom: 24px;
              `}
            >
              Copy invitation
            </IconButton>
          </>
        )
      }
    />
  );
}
