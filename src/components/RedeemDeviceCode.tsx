/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';

import { AnimationMode } from './CodeView';
import DeviceCodeView, { DeviceCodeLoading } from './DeviceCodeView';
import { Key, ContactId } from '../backend/types';
import Backchannel from '../backend';

let backchannel = Backchannel();

export default function RedeemDeviceCode() {
  let [code, setCode] = useState('');
  const [animationMode, setAnimationMode] = useState(AnimationMode.None);

  let [errorMsg, setErrorMsg] = useState('');

  //eslint-disable-next-line
  let [location, setLocation] = useLocation();

  let redeemCode = useCallback(
    async (code) => {
      const onError = (err: Error) => {
        console.error(err);
        setAnimationMode(AnimationMode.None);
        setErrorMsg('Secure connection failed. Please try again.');
      };

      if (animationMode === AnimationMode.Connecting) return;
      try {
        setAnimationMode(AnimationMode.Connecting);
        let key: Key = await backchannel.accept(code);

        let deviceId: ContactId = await backchannel.addDevice(key);
        setErrorMsg('');
        setLocation(`/device/${deviceId}`);
      } catch (err) {
        console.log('got error', err);
        onError(err);
        setCode('');
      }
    },
    [animationMode, setLocation, setAnimationMode]
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

  if (animationMode === AnimationMode.Connecting) {
    return <DeviceCodeLoading />;
  }

  return (
    <DeviceCodeView
      header={'Linking Device'}
      instructions="Enter the temporary code you created on the other device:"
      content={errorMsg}
      message={null}
      footer={null}
    />
  );
}
