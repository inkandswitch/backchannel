/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { A } from './';
import Backchannel from '../backend';

let backchannel = Backchannel();

export default function ContactList(props) {
  let [contacts, setContacts] = useState([]);

  useEffect(() => {
    backchannel.db
      .listContacts()
      .then((contacts) => {
        console.log('got contacts', contacts);
        setContacts(contacts);
      })
      .catch((err) => {
        console.error(err);
      });
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
