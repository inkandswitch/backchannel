/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import Backchannel from '../backend';
import { css } from '@emotion/react/macro';
import { ContactId } from '../backend/types';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import { Spinner } from '.';

let backchannel = Backchannel();

type Props = {
  deviceId: ContactId;
};

export default function Devices({ deviceId }: Props) {
  let [loading, setLoading] = useState(true);
  let [contacts, setContacts] = useState(backchannel.contacts.length)

  useEffect(() => {
    backchannel.on('CONTACT_LIST_SYNC', () => {
      setLoading(false);
      setContacts(backchannel.contacts.length)
    });
    setContacts(backchannel.contacts.length)
    backchannel.connectToContactId(deviceId);
  });

  return <div css={css`
    margin: auto;
    width: 30px;
  `}>
    {loading ? <Spinner /> : <Checkmark />}
  </div>;
}
