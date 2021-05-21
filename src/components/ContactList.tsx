/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';
import { Link } from 'wouter';
import Backchannel from '../backend';
import { color, fontSize } from './tokens';
import { IMessage } from '../backend/types';
import { timestampToDate } from './util';
import { BottomNav } from '../components';
import { ReactComponent as EnterDoor } from './icons/EnterDoor.svg';
import { ReactComponent as Settings } from './icons/Settings.svg';

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
    function refreshContactList() {
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
    }

    refreshContactList();

    backchannel.on('contact.disconnected', refreshContactList);
    backchannel.on('contact.connected', refreshContactList);
    backchannel.on('sync', refreshContactList);
    return function unsub() {
      backchannel.removeListener('contact.disconnected', refreshContactList);
      backchannel.removeListener('contact.connected', refreshContactList);
      backchannel.removeListener('sync', refreshContactList);
    };
  }, []);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        background: ${color.contactListBackground};
        position: relative;
      `}
    >
      <div
        css={css`
          margin-bottom: 100px;
          overflow: auto; /* scroll contact list only */
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
        <Link href="/settings">
          <div
            css={css`
              width: 50px;
              height: 50px;
              cursor: pointer;
            `}
          >
            <Settings />
          </div>
        </Link>
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
        <div
          css={css`
            border-radius: 50%;
            width: 50px;
            height: 50px;
          `}
        ></div>
      </BottomNav>
    </div>
  );
}
