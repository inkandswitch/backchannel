/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';

import useCode from '../hooks/useCode';
import { Spinner } from '.';
import { AnimationMode } from './CodeView';
import DeviceCodeView, { DeviceCodeLoading } from './DeviceCodeView';
import { Key, ContactId } from '../backend/types';
import Backchannel from '../backend';

let backchannel = Backchannel();

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;
// Amount of seconds the user has to share code before it regenerates
const CODE_REGENERATE_TIMER_SEC = 60;
const REDEEM_URL_PATH = '/devices/redeem';

const instructions =
  'Scan this QR code with your phone. Linked devices can see all contacts and message history.';

export default function GenerateDeviceCode() {
  let [code, qrCode] = useCode(CODE_REGENERATE_TIMER_SEC, REDEEM_URL_PATH);

  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  const [animationMode, setAnimationMode] = useState(AnimationMode.None);

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

  // Generate a new code and wait for other party to enter the code.
  let redeemGeneratedCode = useCallback(
    async (code) => {
      const onError = (err: Error) => {
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

  if (animationMode === AnimationMode.Connecting) {
    return <DeviceCodeLoading />;
  }

  return (
    <DeviceCodeView
      header={'Link a device'}
      backHref="/settings/devices"
      instructions={instructions}
      content={
        code ? <img src={qrCode} alt="Scan me with your camera" /> : <Spinner />
      }
      message={errorMsg || message}
      footer={null}
    />
  );
}
