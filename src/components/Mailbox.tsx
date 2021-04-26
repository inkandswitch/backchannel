/** @jsx jsx */
import React, { useState, useEffect } from 'react';
import { jsx, css } from '@emotion/react';
import { ContactId, IMessage, IContact } from '../db';
import { Button } from './';
import Backchannel from '../backchannel';

let backchannel = Backchannel();

type Props = {
  contactId: ContactId;
};

export default function Mailbox(props: Props) {
  let { contactId } = props;
  let [messages, setMessages] = useState([]);
  let [messageText, setMessageText] = useState('');
  let [contact, setContact] = useState(null);
  let [connected, setConnected] = useState(backchannel.isConnected(contactId));

  useEffect(() => {
    function onContact({ contact }) {
      console.log('got a contact', contact);
      if (contact.id === contactId) {
        setContact(contact);
        let connected = backchannel.isConnected(contactId);
        console.log('connected?', connected);
        setConnected(connected);
      }
    }

    let subscribeToConnections = async () => {
      let intendedContact = await backchannel.getContactById(contactId);
      let messages = await backchannel.getMessagesByContactId(contactId);
      setMessages(messages);
      console.log('subscribing to contact', intendedContact);
      backchannel.on('contact.connected', onContact);
      backchannel.on('contact.disconnected', onContact);
      backchannel.connectToContact(intendedContact);
    };

    subscribeToConnections();

    return function () {
      backchannel.off('contact.connected', onContact);
    };
  }, []);

  useEffect(() => {
    let onMessage = (event) => {
      let contact: IContact = event.contact;
      let message: IMessage = event.message;
      console.log('got a message', contact.id, message.id);
      if (contactId === contact.id) {
        setMessages(messages.concat(message));
      }
    };
    backchannel.on('message', onMessage);

    return function cleanup() {
      backchannel.off('message', onMessage);
    };
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    let message = await backchannel.sendMessage(contactId, messageText);
    setMessages(messages.concat(message));
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
