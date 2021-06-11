/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { css } from '@emotion/react/macro';

import { SettingsContent } from './Settings';
import { Button, Instructions, TopBar, UnderlineInput } from '.';
import { Page, ContentWithTopNav } from './';
import Backchannel, { EVENTS } from '../backend';

let backchannel = Backchannel();

export default function UnlinkDeviceScreen() {
  function unlinkButton() {
    // clean local storage state
    for (let device of backchannel.devices) {
      backchannel.on(EVENTS.ACK, ({ contactId }) => {
        console.log('got ack')
      })
      backchannel.lostMyDevice(device.id)
        .then(() => {
          console.log('message sent')
        })
    }

  }

  return (
    <Page align="center">
      <TopBar title="Clear all data" backHref="/settings" />
      <ContentWithTopNav>
        <Instructions>
          This will unlink all devices and delete their data, including contacts
          and messages. You will have to re-sync all your devices. All other
          devices will lose their data except this one. Do you want to proceed?
        </Instructions>
        <SettingsContent>
          <Button onClick={unlinkButton} variant="destructive">
            Yes, unlink all devices
          </Button>
        </SettingsContent>
      </ContentWithTopNav>
    </Page>
  );
}