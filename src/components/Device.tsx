/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import Backchannel, { EVENTS } from '../backend';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import { color } from './tokens';
import {
  Button,
  Instructions,
  Spinner,
  Page,
  TopBar,
  IconWithMessage,
} from '.';
import { ContactId, MessageType } from '../backend/types';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import { ContentWithTopNav, SettingsContent } from './index';
import DeviceCodeView from './DeviceCodeView';

let backchannel = Backchannel();

type Props = {
  deviceId: ContactId;
};

function Status({ loadingMessage = '', message = '', isLoading = false }) {
  let [, setLocation] = useLocation();

  return (
    <div
      css={css`
        text-align: center;
        color: ${color.textSecondary};
      `}
    >
      {' '}
      <IconWithMessage
        icon={isLoading ? Spinner : Checkmark}
        text={isLoading ? loadingMessage : message}
      />
      <Button
        css={css`
          opacity: ${isLoading ? 0 : 1};
        `}
        onClick={() => setLocation('/')}
      >
        OK
      </Button>
    </div>
  );
}

export function Device({ deviceId }: Props) {
  let [loading, setLoading] = useState(true);
  let [device] = useState(backchannel.db.getContactById(deviceId));

  useEffect(() => {
    backchannel.on(EVENTS.CONTACT_LIST_SYNC, () => {
      backchannel.connectToAllContacts();
      setLoading(false);
    });

    let beginTimeout = () => {
      // if the device is connected for 10 seconds but still doesn't
      // get the CONTACT_LIST_SYNC event, we assume it's already up to date
      setTimeout((_) => {
        if (loading === true) setLoading(false);
      }, 1000);
    };

    backchannel.on(EVENTS.CONTACT_CONNECTED, ({ contact }) => {
      if (contact.discoveryKey === device.discoveryKey) beginTimeout();
    });

    if (backchannel.db.isConnected(device)) beginTimeout();
    else backchannel.connectToContact(device);
  }, [device, loading, deviceId]);

  return (
    <DeviceCodeView
      content={
        <Status
          isLoading={loading}
          message="Devices linked"
          loadingMessage="Searching for device"
        />
      }
    />
  );
}

export function UnlinkDevices() {
  let [acks, setAcks] = useState(0);
  let [loading, setLoading] = useState(false);
  let [warning, setWarning] = useState('');
  let [devices] = useState(backchannel.devices.length);

  let onTombstone = (device) => {
    if (!backchannel.db.isConnected(device)) {
      let msg = `One of your devices is not connected to the Internet. Once
      the other device is online at the same time, it will self destruct.
      You will get a notification when all devices have unlinked
      successfully.`;
      setWarning(msg);
    }
  };

  useEffect(() => {
    if (backchannel.devices.length) {
      for (let device of backchannel.devices) {
        let messages = backchannel.getMessagesByContactId(device.id);
        let maybe_tombstone = messages.pop();
        if (maybe_tombstone?.type === MessageType.TOMBSTONE) {
          setLoading(true);
          onTombstone(device);
        }
      }
    }
  }, []);

  useEffect(() => {
    backchannel.on(EVENTS.ACK, () => {
      let newAcks = acks + 1;
      if (newAcks === devices) setWarning('');
      setAcks(newAcks);
    });
  });

  function unlinkButton() {
    setLoading(true);
    // send tombstones
    for (let device of backchannel.devices) {
      backchannel.sendTombstone(device.id).then(() => {
        onTombstone(device);
      });
    }

    setTimeout(() => {
      let msg = `Your device is still waiting for confirmation that the other device
      unlinked. Try refreshing the page.`;

      if (acks === devices || warning.length > 0) return;
      else setWarning(msg);
    }, 10 * 1000);
  }

  // the user shouldn't ever get here but just in case they refresh the page,
  // here's a nice message for them to confirm success.

  let body = (
    <>
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
    </>
  );
  if (devices === 0) body = <Status message={'You have no linked devices'} />;
  else if (loading) {
    body = (
      <>
        {' '}
        {warning && (
          <Instructions variant="destructive">{warning}</Instructions>
        )}
        <div>
          <Spinner />
        </div>
      </>
    );
    if (acks === devices) {
      body = <Status message={'All devices unlinked!'} />;
    }
  }

  return (
    <Page align="center">
      <TopBar title="Unlink devices" backHref="/settings" />
      <ContentWithTopNav
        css={css`
          justify-content: center;
          margin: auto;
        `}
      >
        {body}
      </ContentWithTopNav>
    </Page>
  );
}
