/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import { Button } from './';
import { forceScreenSize } from '../web';
import { viewport } from './tokens';

export default function InstallButton() {
  let [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      event.preventDefault();

      console.log('👍', 'beforeinstallprompt', event);
      // Stash the event so it can be triggered later.
      setDeferredPrompt(event);
    });

    window.addEventListener('appinstalled', (event) => {
      setDeferredPrompt(null);
      forceScreenSize(viewport.maxWidth, viewport.maxHeight);
    });
  });
  if (!deferredPrompt) return null;

  let handleClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();

    const result = await deferredPrompt.userChoice;
    console.log('👍', 'userChoice', result);

    setDeferredPrompt(null);
  };

  return <Button onClick={handleClick}>Install</Button>;
}
