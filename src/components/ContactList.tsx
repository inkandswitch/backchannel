/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';
import { Link } from 'wouter';
import Backchannel from '../backend';
import { color } from './tokens';
import { IMessage } from '../backend/types';
import { timestampToDate } from './util';

let backchannel = Backchannel();

type StatusType = 'disconnected' | 'connected';
type IndicatorDotProps = { status: StatusType };

const IndicatorDot = ({ status = 'disconnected' }: IndicatorDotProps) => (
  <div
    css={css`
      height: 6px;
      width: 6px;
      border-radius: 50%;
      background: ${status === 'connected'
        ? color.indicatorOnline
        : color.indicatorOffline};
    `}
  ></div>
);

export default function ContactList(props) {
  let [contacts, setContacts] = useState([]);
  let [latestMessages, setLatestMessages] = useState([]);

  useEffect(() => {
    backchannel
      .listContacts()
      .then((contacts) => {
        console.log('got contacts', contacts);
        setContacts(contacts);
        contacts.forEach((contact) => {
          backchannel.getMessagesByContactId(contact.id).then((messages) => {
            const lastMessage: IMessage = messages.pop();
            setLatestMessages((latestMessages) => ({
              ...latestMessages,
              [contact.id]: lastMessage,
            }));
          });
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  return (
    <div
      css={css`
        text-align: left;
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
                  <IndicatorDot status={'disconnected'} />
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
                    `}
                  >
                    {contact.moniker}
                  </div>
                  <div
                    css={css`
                      color: ${color.textSecondary};
                    `}
                  >
                    {latestMessageTime}
                  </div>
                </div>
                <div
                  css={css`
                    color: ${color.textSecondary};
                    grid-area: message;
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
  );
}
