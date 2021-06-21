/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import {
  FileState,
  ContactId,
  MessageType,
  FileMessage,
  TextMessage,
  IMessage,
} from '../backend/types';
import { Button, Spinner, TopBar, UnderlineInput } from './';
import Backchannel, { EVENTS } from '../backend';
import { color, fontSize } from './tokens';
import { timestampToDate } from './util';
import { Instructions } from '../components';
import { FileProgress } from '../backend/blobs';
import { ReactComponent as Dots } from '../components/icons/Dots.svg';
import { ReactComponent as Paperclip } from '../components/icons/Paperclip.svg';
import { ReactComponent as Paperplane } from '../components/icons/Paperplane.svg';
import IndicatorDot, { StatusType } from './IndicatorDot';

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
  const [isDragging, setIsDragging] = useState(false);
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

    let subscribeToConnections = async () => {
      backchannel.on(EVENTS.CONTACT_CONNECTED, onContact);
      backchannel.on(EVENTS.CONTACT_DISCONNECTED, onContactDisconnected);
      backchannel.getMessagesByContactId(contactId).then((messages) => {
        setMessages(messages);
      });
    };

    subscribeToConnections();

    return function () {
      backchannel.removeListener(EVENTS.CONTACT_CONNECTED, onContact);
      backchannel.removeListener(
        EVENTS.CONTACT_DISCONNECTED,
        onContactDisconnected
      );
    };
  }, [contactId]);

  useEffect(() => {
    function refreshMessages() {
      backchannel.getMessagesByContactId(contactId).then((messages) => {
        setMessages(messages);
      });
    }

    let onMessage = ({ docId }) => {
      if (contact && docId === contact.discoveryKey) refreshMessages();
    };

    let onMessagesChanged = (progress: FileProgress) => {
      setProgress({ ...progress, [progress.id]: progress.progress });
    };

    refreshMessages();

    backchannel.on(EVENTS.MESSAGE, onMessage);
    backchannel.on(EVENTS.FILE_PROGRESS, onMessagesChanged);
    backchannel.on(EVENTS.FILE_DOWNLOAD, onMessagesChanged);
    backchannel.on(EVENTS.FILE_SENT, onMessagesChanged);
    backchannel.on(EVENTS.ERROR, refreshMessages);

    return function cleanup() {
      backchannel.removeListener(EVENTS.MESSAGE, onMessage);
      backchannel.removeListener(EVENTS.FILE_PROGRESS, onMessagesChanged);
      backchannel.removeListener(EVENTS.FILE_DOWNLOAD, onMessagesChanged);
      backchannel.removeListener(EVENTS.FILE_SENT, onMessagesChanged);
      backchannel.removeListener(EVENTS.ERROR, refreshMessages);
    };
  }, [contactId, contact]);

  async function sendMessage(e) {
    e.preventDefault();
    if (messageText.trim() === '') {
      setMessageText('');
      return;
    }
    let msg = await backchannel.sendMessage(contactId, messageText);
    setMessages(messages.concat(msg));
    setMessageText('');
  }

  function handleChange(event) {
    setMessageText(event.target.value);
  }

  function uploadFiles(files: Array<File>) {
    if (files.length !== 0) {
      for (let i = 0; i < files.length; i++) {
        backchannel.sendFile(contactId, files[i]);
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    uploadFiles(files);
  }

  function handleFileChange(e) {
    uploadFiles(e.target.files);
    e.target.value = null;
  }

  function handleFileUploadClick(e) {
    e.target.value = null;
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDragEnter() {
    setIsDragging(true);
  }

  function handleDragExit() {
    setIsDragging(false);
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

        &:after {
          ${isDragging &&
          `position: absolute;
            color: ${color.textBold};
            content: '✨ Drop file anywhere ✨';
            background: #2E1AE8CC;
            width: 100%;
            height: 50vh;
            text-align: center;
            padding-top: 50vh;
            overflow: hidden;
          `}
        }
      `}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragExit={handleDragExit}
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
            {contact.avatar ? (
              <img
                alt={`nickname for contact ${contact.id}`}
                css={css`
                  max-width: 200px;
                `}
                src={contact.avatar}
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
        <Instructions
          css={css`
            margin-top: 24px;
          `}
        >
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
          {messages.map((message: IMessage) => {
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
                  {message.type === MessageType.TEXT && (message as TextMessage).text}
                  {message.type === MessageType.FILE && (
                    <FileDownloader
                      progress={progress[message.id]}
                      message={message as FileMessage}
                    />
                  )}
                </div>
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
          padding: 12px 6px;
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
        <div
          css={css`
            position: relative;
            overflow: hidden;
            margin: 10px;
            &:hover {
              svg {
                fill: black;
              }
            }
          `}
        >
          <Paperclip />
          <input
            css={css`
              position: absolute;
              top: 0;
              left: 0;
              margin: 0;
              padding: 0;
              opacity: 0;
              cursor: pointer;
            `}
            type="file"
            onChange={handleFileChange}
            onClick={handleFileUploadClick}
            disabled={!contact}
          />
        </div>

        <Button
          css={css`
            box-shadow: none;
            padding: 8px;
          `}
          type="submit"
          disabled={!contact}
        >
          <Paperplane />
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

  let handleDownloadClick = async () => {
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

  let statusIndicator = null;
  switch (state) {
    case FileState.QUEUED:
      statusIndicator = (
        <Spinner
          css={css`
            width: 14px;
            height: 14px;
          `}
        />
      );
      break;
    case FileState.ERROR:
      statusIndicator = '❌';
      break;
    case FileState.SUCCESS:
      // message.incoming ? 'recipient sees file ready to downlaod' : 'sender sees their file was correctly sent'
      statusIndicator = message.incoming ? null : '✔';
  }

  return (
    <>
      <div
        css={css`
          display: flex;
          flex-direction: row;
          align-items: center;
        `}
      >
        <Button
          css={css`
            background: ${color.chatAttachmentBackground};
            color: ${color.chatAttachmentText};
            font-size: ${fontSize[0]}px;
            border-radius: 16px;
            padding: 4px 6px;
            display: inline-flex;
            flex-direction: row;
            align-items: center;
            overflow: hidden;
            box-shadow: none;

            ${!message.incoming &&
            `
            cursor: text;
            user-select: text;
            &:hover {
              filter: none;
            }
            `}
          `}
          disabled={state !== FileState.SUCCESS}
          onClick={FileState.SUCCESS ? handleDownloadClick : null}
        >
          <Paperclip
            css={css`
              height: 16px;
              width: 16px;
              fill: white;
              flex: 0 0 auto;
              padding-right: 6px;
            `}
          />
          <div
            css={css`
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            `}
          >
            {message.name}
          </div>
          <div
            css={css`
              width: 14px;
              font-size: 10px;
              line-height: 10px;
              margin: 0 4px;
            `}
          >
            {statusIndicator}
          </div>
        </Button>
      </div>
      {state === FileState.PROGRESS && (
        <div
          css={css`
            background-color: ${color.border};
            height: 10px;
            width: ${progress * 100}%;
          `}
        />
      )}
    </>
  );
}
