/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import Backchannel from '../backend';
import { ContactId } from '../backend/types';

let backchannel = Backchannel();

type Props = {
  deviceId: ContactId;
};

export default function Devices ({ deviceId } : Props) {
  let [ loading , setLoading ] = useState(true)
  backchannel.on('sync', ({ contactId }) => {
    if (contactId === deviceId) {
      setLoading(false)
      console.log('UPDATED. NOW HAVE', backchannel.contacts.length, ' CONTACTS')
    }

  })
  console.log('FETCHING NEW CONTACTS. NOW HAVE', backchannel.contacts.length, ' CONTACTS')
  backchannel.connectToContactId(deviceId)

  return (
    <div>
      {deviceId}
    </div>
  )
}