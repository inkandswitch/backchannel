/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import Backchannel from '../backend';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import { color } from './tokens';
import { Button, Spinner, Page, TopBar } from '.';
import { ContactId } from '../backend/types';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import { ContentWithTopNav } from './index';

let backchannel = Backchannel();

type Props = {
  deviceId: ContactId;
};

function Done() {
  let [, setLocation] = useLocation();

  return (
    <div
      css={css`
        text-align: center;
        color: ${color.textSecondary};
      `}
    >
      <Checkmark />
      <div
        css={css`
          margin: 20px;
        `}
      >
        Device syncronized!
      </div>
      <Button onClick={() => setLocation('/')}>OK</Button>
    </div>
  );
}

export default function Devices({ deviceId }: Props) {
  let [loading, setLoading] = useState(true);
  let [device, ] = useState(backchannel.db.getContactById(deviceId));

  useEffect(() => {
    backchannel.on('CONTACT_LIST_SYNC', () => {
      setLoading(false);
    });

    let beginTimeout = () => {
      // if the device is connected for 10 seconds but still doesn't
      // get the CONTACT_LIST_SYNC event, we assume it's already up to date
      setTimeout((_) => {
        console.log('boop', loading);
        if (loading === true) setLoading(false);
      }, 1000);
    };

    backchannel.on('contact.connected', ({ contact }) => {
      if (contact.discoveryKey === device.discoveryKey) beginTimeout();
    });

    if (backchannel.db.isConnected(device)) beginTimeout();

    backchannel.devices.forEach((d) => {
      backchannel.connectToContact(d);
    });
  }, [device, loading, deviceId]);

  return (
    <Page>
      <TopBar></TopBar>
      <ContentWithTopNav
        css={css`
          justify-content: center;
          margin: auto;
        `}
      >
        {loading ? <Spinner /> : <Done />}
      </ContentWithTopNav>
    </Page>
  );
}
