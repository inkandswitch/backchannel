/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';
import { ContactId } from '../backend/types';
import { Button } from './';
import Backchannel from '../backend';
import { color, fontSize } from './tokens';
import { timestampToDate } from './util';
import { ReactComponent as ArrowLeft } from './icons/ArrowLeft.svg';
import { TopBar } from '../components';
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
  let [contact, setContact] = useState(
    backchannel.db.getContactById(contactId)
  );
  let [connected, setConnected] = useState(contact && contact.isConnected);

  useEffect(() => {
    function onContact({ contact }) {
      if (contact.id === contactId) {
        console.log('contact connected', contactId);
        setContact(contact);
        setConnected(true);
      }
    }
    function onContactDisconnected({ contact }) {
      if (contact.id === contactId) {
        console.log('contact disconnected', contactId);
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
    let onMessage = (docId) => {
      if (contact && docId === contact.discoveryKey) {
        let messages = backchannel.getMessagesByContactId(contactId);
        setMessages(messages);
      }
    };
    backchannel.db.on('patch', onMessage);

    return function cleanup() {
      backchannel.removeListener('message', onMessage);
    };
  }, [contactId, contact]);

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
        word-break: break-word;
        background: ${color.primary};
        display: flex;
        flex-direction: column;
        text-align: left;
        position: relative;
        height: 100%;
      `}
    >
      <TopBar>
        <div>
          <Link href="/">
            <ArrowLeft
              css={css`
                cursor: pointer;
                padding: 0 18px;
              `}
            />
          </Link>
        </div>
        <div
          css={css`
            flex: 1 0 auto;
          `}
        >
          {contact ? contact.moniker : ''} {contact && connected ? '🤠' : '😪'}
        </div>
      </TopBar>
      <div
        css={css`
          margin-top: 60px;
          overflow: auto; /* scroll messages only */
          flex: 1 auto;
        `}
      >
        <ul
          css={css`
            list-style: none;
            margin: 0;
            padding: 0;
          `}
        >
          {messages.map((message) => {
            message.incoming = contactId !== message.target
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
                    font-size: ${fontSize[0]}px;
                    margin-top: 6px;
                  `}
                >
                  {timestampToDate(message.timestamp)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
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
