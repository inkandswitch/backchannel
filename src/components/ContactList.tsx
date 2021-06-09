/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { Link } from 'wouter';
import Backchannel from '../backend';
import { color, fontSize } from './tokens';
import { IMessage } from '../backend/types';
import Automerge from 'automerge';
import { Mailbox } from '../backend/backchannel';
import { timestampToDate } from './util';
import {
  BottomNav,
  Button,
  Instructions,
  Spinner,
  IconWithMessage,
  Page,
  Content,
  ContentWithBottomNav,
  Text,
} from '../components';
import { ReactComponent as EnterDoor } from './icons/EnterDoor.svg';
import { ReactComponent as Settings } from './icons/Settings.svg';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import * as storage from './storage';
import IndicatorDot, { StatusType } from './IndicatorDot';

let backchannel = Backchannel();
const APP_INITIATION_ANIMATION_MS = 2300;
const LOADING_SCREEN_DELAY_MS = 800;

export default function ContactList(props) {
  let [contacts, setContacts] = useState([]);
  let [isLoaded, setIsLoaded] = useState(false);
  let [canShowLoading, setCanShowLoading] = useState(false);
  let [showInitiationAnimation, setShowInitiationAnimation] = useState(false);
  let [acknowledged, setAcknowledged] = useState(true);
  let [latestMessages, setLatestMessages] = useState([]);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    // wait a second before showing loading screen, so that the loading screen is less likely to flash for a couple milliseconds before content is ready
    const timeout = setTimeout(() => {
      setCanShowLoading(true);
    }, LOADING_SCREEN_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [canShowLoading]);

  // Timer for showing app first-time initiation animation
  useEffect(() => {
    if (showInitiationAnimation) {
      const timeout = setTimeout(() => {
        setShowInitiationAnimation(false);
        // Make sure the button to proceed is visible!
        scrollToConfirmButton();
      }, APP_INITIATION_ANIMATION_MS);

      return () => clearTimeout(timeout);
    }
  }, [showInitiationAnimation]);

  useEffect(() => {
    function refreshContactList() {
      let contacts = backchannel.listContacts();
      setIsLoaded(true);
      setContacts(contacts);

      if (contacts.length === 0) {
        // Check if user has gone through the initial welcome message
        const dismissedWelcome: boolean = storage.get(
          storage.keys.dismissed_welcome_message
        );
        if (!dismissedWelcome) {
          // Start the initial animation if user hasn't seen the welcome screen before
          setShowInitiationAnimation(true);
        }
        setAcknowledged(dismissedWelcome);
      }
      contacts.forEach(async (contact) => {
        let messages = backchannel.getMessagesByContactId(contact.id);

        if (!messages) {
          let doc = (await backchannel._addContactDocument(
            contact
          )) as Automerge.Doc<Mailbox>;
          messages = doc.messages;
        }
        const lastMessage: IMessage = messages[messages.length - 1];
        setLatestMessages((latestMessages) => ({
          ...latestMessages,
          [contact.id]: lastMessage,
        }));
      });
    }

    refreshContactList();

    backchannel.on('contact.disconnected', refreshContactList);
    backchannel.on('contact.connected', refreshContactList);
    backchannel.db.on('patch', refreshContactList);
    return function unsub() {
      backchannel.removeListener('contact.disconnected', refreshContactList);
      backchannel.removeListener('contact.connected', refreshContactList);
      backchannel.db.removeListener('patch', refreshContactList);
    };
  }, []);

  const scrollToConfirmButton = () => {
    confirmButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAcknowledge = () => {
    storage.set(storage.keys.dismissed_welcome_message, true);
    setAcknowledged(true);
  };

  if (isLoaded && !acknowledged) {
    return (
      <Page>
        <Content
          css={css`
            color: ${color.textBold};
            text-align: center;
          `}
        >
          <h4>How does it work?</h4>
          <Text>
            First a new secret key is generated on your device. No user account
            is created: no username, email or password is required since your
            device and your correspondant's handle the authentification.
          </Text>
          <h4>Security</h4>
          <Text>
            All content is end-to-end encrypted. The data is as secure as your
            knowledge and trust of your correspondant.
          </Text>
          <IconWithMessage
            icon={showInitiationAnimation ? Spinner : Checkmark}
            text="Creating the key"
          />
          <Instructions
            css={css`
              opacity: ${showInitiationAnimation ? 0 : 1};
            `}
          >
            Your device is set up and ready to go.
          </Instructions>
          <Button
            css={css`
              margin: 12px;
            `}
            onClick={handleAcknowledge}
            disabled={showInitiationAnimation}
          >
            Get Started
          </Button>
          <div ref={confirmButtonRef} />
        </Content>
      </Page>
    );
  }

  if (isLoaded && acknowledged) {
    return (
      <Page>
        <ContentWithBottomNav>
          {contacts.length === 0 ? (
            <div
              css={css`
                color: ${color.textBold};
                display: flex;
                flex: 1 0 auto;
                flex-direction: column;
                justify-content: center;
                text-align: center;
                align-items: center;
                height: 100%;
              `}
            >
              <BackchannelLink />
              <div
                css={css`
                  margin-top: 14px;
                `}
              >
                Start a backchannel & add a contact
              </div>
            </div>
          ) : (
            <ul
              css={css`
                list-style: none;
                padding-left: 0;
                margin: 0;
                margin-bottom: 100px;
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
          )}
        </ContentWithBottomNav>
        <BottomNav>
          <Link href="/settings">
            <div
              css={css`
                width: 50px;
                height: 50px;
                cursor: pointer;
              `}
            >
              <Settings
                css={css`
                  background: ${color.contactListBackground};
                  border-radius: 50%;
                `}
              />
            </div>
          </Link>
          {contacts.length > 0 ? (
            <BackchannelLink />
          ) : (
            <div
              css={css`
                width: 76px;
              `}
            />
          )}
          <div
            css={css`
              border-radius: 50%;
              width: 50px;
              height: 50px;
            `}
          ></div>
        </BottomNav>
      </Page>
    );
  }

  if (!isLoaded && canShowLoading) {
    // Show loading spinner
    return (
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        `}
      >
        <Spinner />
      </div>
    );
  }

  // if (!isLoaded || !canShowLoading), return empty screen until wait time to show loading screen passes
  return <div></div>;
}

function BackchannelLink() {
  return (
    <Link href="/generate/contact">
      <div
        css={css`
          background: ${color.primaryButtonBackground};
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
  );
}
