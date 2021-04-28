import React, { useState, useEffect } from 'react';
import { jsx, css } from '@emotion/react/macro';
import { Link, Route, useLocation } from 'wouter';
import { A } from './';
import Backchannel from '../backchannel';

let backchannel = Backchannel();

export default function ContactList(props) {
  let [contacts, setContacts] = useState([]);

  useEffect(() => {
    backchannel
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
