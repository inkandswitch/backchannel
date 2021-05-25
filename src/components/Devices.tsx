/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import Backchannel from '../backend';
import { ContactId } from '../backend/types';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import { Spinner } from '../components';

let backchannel = Backchannel();

type Props = {
  deviceId: ContactId;
};

export default function Devices ({ deviceId } : Props) {
  let [ loading , setLoading ] = useState(true)

  useEffect(() => {
    backchannel.on('CONTACT_LIST_SYNC', ({ docId, contactId }) => {
      if (contactId === deviceId) {
        setLoading(false)
      }
      console.log('UPDATED. NOW HAVE', backchannel.contacts.length, ' CONTACTS')

    })
    console.log('FETCHING NEW CONTACTS. NOW HAVE', backchannel.contacts.length, ' CONTACTS')
    backchannel.connectToContactId(deviceId)
  })

  return (
    <div>
      {loading ? <Spinner /> : <Checkmark />}
    </div>
  )
}