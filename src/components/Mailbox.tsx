/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';
import { ContactId, IMessage, IContact } from '../backend/types';
import { Button } from './';
import Backchannel from '../backend';

let backchannel = Backchannel();

type Props = {
  contactId: ContactId;
};

export default function Mailbox(props: Props) {
  let { contactId } = props;
  let [messages, setMessages] = useState([]);
  let [messageText, setMessageText] = useState('');
  let [contact, setContact] = useState(null);
  let [connected, setConnected] = useState(false);

  useEffect(() => {
    function onContact({ contact }) {
      if (contact.id === contactId) {
        setContact(contact);
        setConnected(true);
      }
    }
    function onContactDisconnected({ contact }) {
      if (contact.id === contactId) {
        setConnected(false);
      }
    }

    let subscribeToConnections = async () => {
      let intendedContact = backchannel.db.getContactById(contactId);
      let messages = backchannel.getMessagesByContactId(contactId);
      setMessages(messages);
      backchannel.on('contact.connected', onContact);
      backchannel.on('contact.disconnected', onContactDisconnected);
      backchannel.connectToContact(intendedContact);
    };

    subscribeToConnections();

    return function () {
      backchannel.removeListener('contact.connected', onContact);
    };
  }, [contactId]);

  useEffect(() => {
    let onMessage = ({ docId, peerId }) => {
      if (contact && peerId === contact.id) {
        let messages = backchannel.getMessagesByContactId(contactId);
        setMessages(messages);
      }
    };
    backchannel.on('sync', onMessage);

    return function cleanup() {
      backchannel.removeListener('message', onMessage);
    };
  }, [contactId, contact, messages]);

  async function sendMessage(e) {
    e.preventDefault();
    let msg = await backchannel.sendMessage(contactId, messageText);
    setMessages(messages.concat(msg));
    setMessageText('');
  }

  function handleChange(event) {
    setMessageText(event.target.value);
  }

  return (
    <div
      css={css`
        display: inline-block;
        margin: 16px 0;
        word-break: break-word;
      `}
    >
      <ul>
        {messages.map((message) => {
          return <li key={message.id}>{message.text}</li>;
        })}
      </ul>

      {connected ? (
        <div>Connected to {contact.moniker}</div>
      ) : (
        <div>Not Connected</div>
      )}

      <form onSubmit={sendMessage}>
        <input type="text" value={messageText} onChange={handleChange} />
        <Button type="submit" disabled={!contact}>
          Send
        </Button>
      </form>
    </div>
  );
}
