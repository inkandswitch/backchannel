/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { A } from './';
import Backchannel from '../backend';

let backchannel = Backchannel();

export default function ContactList(props) {
  let [contacts, setContacts] = useState([]);

  useEffect(() => {
    let contacts = backchannel.listContacts();
    setContacts(contacts);
  }, []);

  return (
    <div>
      <ul>
        {contacts.map((contact) => {
          return (
            <li key={contact.id}>
              <A href={`mailbox/${contact.id}`}>{contact.moniker}</A>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
