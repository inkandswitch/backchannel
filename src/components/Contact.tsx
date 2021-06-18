/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';
import { ReactSketchCanvas } from 'react-sketch-canvas';

import {
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  UnderlineInput,
  Page,
  TopBar,
  Toggle,
  ToggleWrapper,
  IconButton,
} from './';
import { color } from './tokens';
import WormholePlaceholder from './images/WormholePlaceholder.png';
import { ReactComponent as HatPerson } from './icons/HatPerson.svg';
import { ContactId, IContact } from '../backend/types';
import Backchannel from '../backend';

let backchannel = Backchannel();

type ViewType = 'write' | 'draw';

type Props = {
  contactId: ContactId;
};

export default function Contact({ contactId }: Props) {
  let [nickname, setNickname] = useState<string>('');
  let [contact, setContact] = useState<IContact>();
  let [view, setView] = useState<ViewType>('draw');
  let [errorMsg, setErrorMsg] = useState('');
  //eslint-disable-next-line
  let [_, setLocation] = useLocation();
  const canvasRef = useRef(null);

  async function handleSaveNicknameDrawing(e) {
    e.preventDefault();

    const imgData = await canvasRef.current?.exportImage('png');

    try {
      // Set the avatar image
      let contact = await backchannel.editAvatar(contactId, imgData);
      // Remove the moniker since we only want to show the avatar
      contact = await backchannel.editMoniker(contactId, '');
      setContact(contact);
      canvasRef.current.resetCanvas();
      setLocation(`/mailbox/${contactId}`);
    } catch (err) {
      onError(err);
    }
  }

  useEffect(() => {
    backchannel.connectToContactId(contactId);
  }, [contactId]);

  async function handleSaveNicknameText(e) {
    e.preventDefault();
    try {
      // Set the moniker
      let contact = await backchannel.editMoniker(contactId, nickname);
      // Remove the avatar
      contact = await backchannel.editAvatar(contactId, null);
      setContact(contact);
      setLocation(`/mailbox/${contactId}`);
    } catch (err) {
      onError(err);
    }
  }

  function handleChange(event) {
    setErrorMsg('');
    setNickname(event.target.value);
  }

  function handleToggleClick(e) {
    e.preventDefault();
    setView(e.target.name);
  }

  let onError = (err: Error) => {
    console.error('got error from backend', err);
    setErrorMsg(err.message);
  };

  return (
    <Page
      css={css`
        background-color: #001e93; /* TODO wormhole animation */
        background-image: url('${WormholePlaceholder}'); /* TODO wormhole animation */
        background-size: cover;
        background-position: center;
      `}
    >
      <TopBar
        css={css`
          background: none;
        `}
      />
      <ContentWithTopNav
        css={css`
          text-align: center;
        `}
      >
        <Message>{errorMsg}</Message>
        <Instructions></Instructions>
        <CodeDisplayOrInput
          css={css`
            justify-content: flex-start;
          `}
        >
          <ToggleWrapper
            css={css`
              margin-bottom: 12px;
              background: ${color.nicknameToggleBackground};
            `}
          >
            <Toggle
              name="write"
              onClick={handleToggleClick}
              isActive={view === 'write'}
            >
              Write
            </Toggle>
            <Toggle
              name="draw"
              onClick={handleToggleClick}
              isActive={view === 'draw'}
            >
              Draw
            </Toggle>
          </ToggleWrapper>
          {view === 'write' && (
            <form
              css={css`
                background: white;
                padding: 22px 30px;
              `}
              id="input-nickname"
            >
              <UnderlineInput
                css={css`
                  border-bottom: 2px solid ${color.borderInverse};
                  color: ${color.textInverse};
                  font-family: monospace;
                  padding: 2px 0;

                  &:focus {
                    border-bottom: 2px solid ${color.borderInverseFocus};
                    transition: 0.2s;
                  }
                `}
                type="text"
                onChange={handleChange}
                defaultValue={contact ? contact.moniker : ''}
                placeholder="Contact nickname"
                autoFocus
              />
            </form>
          )}
          {view === 'draw' && (
            <div
              css={css`
                background: white;
              `}
            >
              {' '}
              <ReactSketchCanvas
                width="400"
                height="80"
                strokeWidth={4}
                strokeColor="black"
                ref={canvasRef}
              />
            </div>
          )}
        </CodeDisplayOrInput>
        <BottomActions>
          <IconButton
            onClick={
              view === 'write'
                ? handleSaveNicknameText
                : handleSaveNicknameDrawing
            }
            type="submit"
            form="input-nickname"
            label=" Confirm nickname"
            icon={HatPerson}
          />
        </BottomActions>
      </ContentWithTopNav>
    </Page>
  );
}
