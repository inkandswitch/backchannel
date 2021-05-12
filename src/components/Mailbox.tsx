/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';
import { ContactId, IMessage, IContact } from '../backend/types';
import { Button } from './';
import Backchannel from '../backend';
import { color, fontSize } from './tokens';
import { timestampToDate } from './util';
import ArrowLeft from './icons/ArrowLeft.svg';
import { Link } from 'wouter';

let backchannel = Backchannel();
const PADDING_CHAT = 12;

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
      backchannel.removeListener('contact.connected', onContact);
    };
  }, [contactId]);

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
      backchannel.removeListener('message', onMessage);
    };
  }, [contactId, messages]);

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
        word-break: break-word;
        background: ${color.primary};
        display: flex;
        flex-direction: column;
        text-align: left;
        min-height: 100vh;
      `}
    >
      <div
        css={css`
          background: ${color.primary};
          color: ${color.chatHeaderText};
          text-align: center;
          padding: 18px;
          position: fixed;
          width: 100%;
          display: flex;
          flex-direction: row;
        `}
      >
        <Link href="/">
          <img
            src={ArrowLeft}
            css={css`
              cursor: pointer;
            `}
          />
        </Link>
        <div
          css={css`
            flex: 1 0 auto;
          `}
        >
          {contact ? contact.moniker : ''} {contact && connected ? '🤠' : '😪'}
        </div>
      </div>
      <ul
        css={css`
          list-style: none;
          margin: 0;
          padding: 0;
          padding-top: 60px;
          flex: 1 0 auto;
        `}
      >
        {messages.map((message) => {
          return (
            <li
              key={message.id}
              css={css`
                padding: ${PADDING_CHAT}px;
                ${message.incoming
                  ? `margin-right: ${PADDING_CHAT + 30}px`
                  : `margin-left: ${PADDING_CHAT + 30}px`};
              `}
            >
              <div
                css={css`
                  background: ${message.incoming
                    ? color.chatBackgroundIncoming
                    : color.chatBackgroundYou};
                  color: ${color.chatText};
                  padding: 18px;
                  border-radius: 1px;
                `}
              >
                <div></div>
                {message.text}
              </div>{' '}
              <div
                css={css`
                  text-align: ${message.incoming ? 'left' : 'right'};
                  color: ${color.chatTimestamp};
                  font-size: ${fontSize[0]};
                  margin-top: 6px;
                `}
              >
                {timestampToDate(message.timestamp)}
              </div>
            </li>
          );
        })}
      </ul>

      <form
        css={css`
          display: flex;
          margin-block-end: 0;
        `}
        onSubmit={sendMessage}
      >
        <input
          css={css`
            flex: 1 0 auto;
          `}
          type="text"
          value={messageText}
          onChange={handleChange}
        />
        <Button type="submit" disabled={!contact}>
          Send
        </Button>
      </form>
    </div>
  );
}
