/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import {
  FileState,
  ContactId,
  MessageType,
  FileMessage,
} from '../backend/types';
import { Button, TopBar, UnderlineInput } from './';
import Backchannel from '../backend';
import { color, fontSize } from './tokens';
import { timestampToDate } from './util';
import { Instructions } from '../components';
import { FileProgress } from '../backend/blobs';
import { ReactComponent as Dots } from '../components/icons/Dots.svg';
import IndicatorDot, { StatusType } from './IndicatorDot';
import * as storage from './storage';

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
  let [connected, setConnected] = useState(
    contact && backchannel.db.isConnected(contact)
  );
  let [progress, setProgress] = useState({});
  //eslint-disable-next-line
  const [_, setLocation] = useLocation();
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Whenever new messages are recieved, scroll down to show it.
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    let subscribeToConnections = () => {
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
      backchannel.removeListener('contact.disconnected', onContactDisconnected);
    };
  }, [contactId]);

  useEffect(() => {
    function refreshMessages() {
      let messages = backchannel.getMessagesByContactId(contactId);
      setMessages(messages);
    }

    let onMessage = ({ docId }) => {
      if (contact && docId === contact.discoveryKey) refreshMessages();
    };

    let onMessagesChanged = (progress: FileProgress) => {
      setProgress({ ...progress, [progress.id]: progress.progress });
    };

    refreshMessages();

    backchannel.db.on('patch', onMessage);
    backchannel.on('progress', onMessagesChanged);
    backchannel.on('download', onMessagesChanged);
    backchannel.on('sent', onMessagesChanged);
    backchannel.on('error', refreshMessages);

    return function cleanup() {
      backchannel.db.removeListener('patch', onMessage);
      backchannel.removeListener('progress', onMessagesChanged);
      backchannel.removeListener('download', onMessagesChanged);
      backchannel.removeListener('sent', onMessagesChanged);
      backchannel.removeListener('error', refreshMessages);
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
        backchannel.sendFile(contactId, files[i]);
      }
    }
  }

  function onDragOver(event) {
    event.preventDefault();
  }

  const nicknameDrawing = storage.getNicknameImage(contact?.moniker);

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
        title={
          <div
            css={css`
              display: flex;
              flex-direction: row;
              align-items: center;
            `}
          >
            <IndicatorDot
              css={css`
                margin-right: 6px;
              `}
              status={
                connected ? StatusType.CONNECTED : StatusType.DISCONNECTED
              }
            />
            {nicknameDrawing ? (
              <img
                alt={`nickname for contact ${contact.id}`}
                css={css`
                  max-width: 200px;
                `}
                src={nicknameDrawing}
              />
            ) : (
              contact?.moniker
            )}
          </div>
        }
        // TODO set location back to the contact settings rather than petname assigning page
        icon={
          <Dots onClick={() => setLocation(`/contact/${contact?.id}/add`)} />
        }
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
            // TODO: ugly
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
                  {message.type === MessageType.TEXT && message.text}
                  {message.type === MessageType.FILE && (
                    <FileDownloader
                      progress={progress[message.id]}
                      message={message}
                    />
                  )}
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
        <div ref={bottomRef} />
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
          autoFocus
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

type FileDownloaderProps = { progress: number; message: FileMessage };

function FileDownloader(props: FileDownloaderProps) {
  let { progress, message } = props;

  let state = message.state;
  if (state !== FileState.ERROR) {
    if (progress > -1 && progress < 1) state = FileState.PROGRESS;
    if (progress === 1) state = FileState.SUCCESS;
  }

  let download = async () => {
    let data: Uint8Array = await backchannel.db.getBlob(message.id);
    // on the incoming side we only know it's erroring if this blob doesn't exist
    if (data) {
      const blob = new Blob([data], { type: message.mime_type });
      let a = document.createElement('a');
      document.body.appendChild(a);
      a.href = URL.createObjectURL(blob);
      a.download = message.name;
      a.click();
      document.body.removeChild(a);
    }
  };

  let element = null;
  switch (state) {
    case FileState.QUEUED:
      element = 'spinner';
      break;
    case FileState.ERROR:
      element = 'error';
      break;
    case FileState.PROGRESS:
      element = (
        <div
          css={css`
            background-color: ${color.border};
            height: 10px;
            width: ${progress * 100}%;
          `}
        />
      );
      break;
    default:
      element = message.incoming ? (
        <div onClick={download}>download</div>
      ) : (
        'success'
      );
  }

  return (
    <div>
      {message.name}
      {element}
    </div>
  );
}
