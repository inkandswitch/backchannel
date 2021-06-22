/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import useCode, { CodeType } from '../hooks/useCode';
import { copyToClipboard } from '../web';
import { Button, Spinner, Toggle, ToggleWrapper, IconButton } from '.';
import { AnimationMode } from './CodeView';
import DeviceCodeView, { DeviceCodeLoading } from './DeviceCodeView';
import { Key, ContactId } from '../backend/types';
import { ReactComponent as Copy } from './icons/Copy.svg';
import Backchannel from '../backend';
import { color } from './tokens';

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

export default function GenerateDeviceCode() {
  let [codeType, setCodeType] = useState<CodeType>(CodeType.WORDS);
  let [code, qrCode] = useCode(codeType, CODE_REGENERATE_TIMER_SEC);

  let [tab, setTab] = useState<Tab>(Tab.QRCODE);
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [animationMode, setAnimationMode] = useState(AnimationMode.None);

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
        setAnimationMode(AnimationMode.Connecting);

        let deviceId: ContactId = await backchannel.addDevice(key);
        setErrorMsg('');
        setLocation(`/device/${deviceId}`);
      } catch (err) {
        if (err.message.startsWith('This code has expired')) {
          // TODO differentiate between an actual backend err (which should be displayed) vs the code timing out (which should happen quietly).
        } else {
          onError(err);
        }
      }
    },
    [setLocation, setAnimationMode]
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

  async function onClickShareURL() {
    let url = window.location.origin + '/devices/redeem';
    if (sharable) {
      navigator
        .share({
          title: 'Link devices on backchannel',
          text: code,
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

  if (animationMode === AnimationMode.Connecting) {
    return <DeviceCodeLoading />;
  }

  return (
    <DeviceCodeView
      header={
        <ToggleWrapper
          css={css`
            background: ${color.deviceLinkToggleBackground};
          `}
        >
          <Toggle
            onClick={handleToggleClick(Tab.WORDS, CodeType.WORDS)}
            isActive={tab === Tab.WORDS}
          >
            Words
          </Toggle>
          <Toggle
            onClick={handleToggleClick(Tab.NUMBERS, CodeType.NUMBERS)}
            isActive={tab === Tab.NUMBERS}
          >
            Numbers
          </Toggle>
          <Toggle
            onClick={handleToggleClick(Tab.QRCODE)}
            isActive={tab === Tab.QRCODE}
          >
            QR Code
          </Toggle>
        </ToggleWrapper>
      }
      instructions="Use this temporary code in Backchannel on the device you wish to synchronise the data with:"
      content={
        tab === Tab.QRCODE ? (
          <img src={qrCode} alt="Scan me with your camera" />
        ) : code ? (
          code
        ) : (
          <Spinner />
        )
      }
      message={errorMsg || message}
      footer={
        tab !== Tab.QRCODE && (
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
        )
      }
    />
  );
}
