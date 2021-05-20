/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';
import { Link } from 'wouter';
import Backchannel from '../backend';
import { color, fontSize } from './tokens';
import { IMessage } from '../backend/types';
import { timestampToDate } from './util';
import { BottomNav, Button } from '../components';
import { ReactComponent as EnterDoor } from './icons/EnterDoor.svg';

let backchannel = Backchannel();

enum StatusType {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
}
type IndicatorDotProps = { status: StatusType };

const IndicatorDot = ({
  status = StatusType.DISCONNECTED,
}: IndicatorDotProps) => (
  <div
    css={css`
      height: 6px;
      width: 6px;
      border-radius: 50%;
      background: ${status === StatusType.CONNECTED
        ? color.indicatorOnline
        : color.indicatorOffline};
    `}
  ></div>
);

export default function ContactList(props) {
  let [contacts, setContacts] = useState([]);
  let [latestMessages, setLatestMessages] = useState([]);

  useEffect(() => {
    let contacts = backchannel.listContacts();
    console.log('got contacts', contacts);
    setContacts(contacts);
    contacts.forEach((contact) => {
      let messages = backchannel.getMessagesByContactId(contact.id);
      const lastMessage: IMessage = messages.pop();
      setLatestMessages((latestMessages) => ({
        ...latestMessages,
        [contact.id]: lastMessage,
      }));
    });
  }, []);

  function clearDb() {
    backchannel
      .destroy()
      .then(() => {
        console.log('cleared database! refresh.');
      })
      .catch((err) => {
        console.error('error clearing db', err);
      });
  }

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: ${color.contactListBackground};
        overflow: scroll;
      `}
    >
      <div
        css={css`
          padding-bottom: 100px;
        `}
      >
        <ul
          css={css`
            list-style: none;
            padding-left: 0;
            margin: 0;
          `}
        >
          {contacts.map((contact) => {
            let latestMessage, latestMessageTime;
            if (latestMessages && latestMessages[contact.id]) {
              latestMessage = latestMessages[contact.id];
              latestMessageTime = timestampToDate(latestMessage.timestamp);
            }
            let status = contact.isConnected
              ? StatusType.CONNECTED
              : StatusType.DISCONNECTED;

            return (
              <Link key={contact.id} href={`mailbox/${contact.id}`}>
                <li
                  css={css`
                    border-bottom: 1px solid ${color.border};
                    padding: 20px;
                    cursor: pointer;

                    &:hover {
                      background: ${color.backgroundHover};
                    }

                    display: grid;
                    grid-template-columns: auto 2fr;
                    grid-template-rows: auto 1fr;
                    gap: 6px 12px;
                    grid-template-areas:
                      'indicator contact-info'
                      '. message';
                  `}
                >
                  <div
                    css={css`
                      grid-area: indicator;
                      display: flex;
                      align-items: center;
                    `}
                  >
                    <IndicatorDot status={status} />
                  </div>
                  <div
                    css={css`
                      display: flex;
                      flex-direction: row;
                    `}
                  >
                    <div
                      css={css`
                        color: ${color.textBold};
                        font-weight: bold;
                        flex: 1 0 auto;
                        margin-left: 0;
                        padding-left: 0;
                        font-size: ${fontSize[2]};
                      `}
                    >
                      {contact.moniker}
                    </div>
                    <div
                      css={css`
                        color: ${color.textSecondary};
                        font-size: ${fontSize[1]};
                      `}
                    >
                      {latestMessageTime}
                    </div>
                  </div>
                  <div
                    css={css`
                      color: ${color.textSecondary};
                      grid-area: message;
                      font-size: ${fontSize[1]};
                    `}
                  >
                    {latestMessage ? latestMessage.text : ''}
                  </div>
                </li>
              </Link>
            );
          })}
        </ul>
      </div>
      <BottomNav>
        <div
          css={css`
            border: 2px solid ${color.border};
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          `}
        ></div>
        <Link href="/generate">
          <div
            css={css`
              background: ${color.backchannelButtonBackground};
              border-radius: 50%;
              width: 76px;
              height: 76px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
            `}
          >
            <EnterDoor />
          </div>
        </Link>
        <Button onClick={clearDb}>ClearDB</Button>
      </BottomNav>
    </div>
  );
}
