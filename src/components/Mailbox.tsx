/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';
import { ContactId } from '../backend/types';
import { Button, TopBar, UnderlineInput } from './';
import Backchannel from '../backend';
import { color, fontSize } from './tokens';
import { timestampToDate } from './util';
import { Instructions } from '../components';

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
    let onMessage = ({ docId }) => {
      if (contact && docId === contact.discoveryKey) {
        let messages = backchannel.getMessagesByContactId(contactId);
        setMessages(messages);
      }
    };
    backchannel.on('progress', (progress) => {
      console.log('progress', progress)
    })
    backchannel.on('download', (receiving) => {
      const blob = new Blob([receiving.data], {type: receiving.type});
      let a = document.createElement('a')
      document.body.appendChild(a)
      a.href = URL.createObjectURL(blob);
      a.download = receiving.name;
      a.click();
    })
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

  function handleDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length !== 0) {
      for (let i = 0; i < files.length; i++) {
        backchannel.sendFile(contactId, files[i]).then(msg => {
          console.log('message sent!')
        })
      }
    }
  }

  function onDragOver(event) {
    event.preventDefault();
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
      onDragOver={onDragOver}
      onDrop={handleDrop}
    >
      <TopBar
        title={`${contact ? contact.moniker : ''} ${
          contact && connected ? '🤠' : '😪'
        }`}
      />
      <div
        css={css`
          margin-top: 60px;
          overflow: auto; /* scroll messages only */
          flex: 1 auto;
        `}
      >
        <Instructions>
          Encrypted backchannel opened. From now on all exchanges with this
          contact will be displayed here.
        </Instructions>
        <ul
          css={css`
            list-style: none;
            margin: 0;
            padding: 0;
          `}
        >
          {messages.map((message) => {
            message.incoming = contactId !== message.target;
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
          background: white;
          align-items: center;
        `}
        onSubmit={sendMessage}
      >
        <UnderlineInput
          css={css`
            color: ${color.chatText};
            text-align: unset;
            flex: 1;
            margin: 10px;

            &:focus {
              border-bottom: 2px solid ${color.border};
            }
          `}
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
