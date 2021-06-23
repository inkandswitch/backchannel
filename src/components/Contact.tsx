/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';
import { ReactSketchCanvas } from 'react-sketch-canvas';

import { UnderlineInput, Toggle, ToggleWrapper, IconButton } from './';
import { color } from './tokens';
import CodeView from './CodeView';
import { ReactComponent as HatPerson } from './icons/HatPerson.svg';
import { ContactId, IContact } from '../backend/types';
import Backchannel from '../backend';

let backchannel = Backchannel();

enum Tab {
  Write,
  Draw,
}

type Props = {
  contactId: ContactId;
  backHref?: string | null;
};

export default function Contact({ contactId, backHref }: Props) {
  let [nickname, setNickname] = useState<string>('');
  let [contact, setContact] = useState<IContact>();
  let [tab, setTab] = useState<Tab>(Tab.Draw);
  let [errorMsg, setErrorMsg] = useState('');
  let [, setLocation] = useLocation();
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

  function handleToggleClick(tab: Tab) {
    return () => {
      setTab(tab);
    };
  }

  let onError = (err: Error) => {
    console.error('got error from backend', err);
    setErrorMsg(err.message);
  };

  return (
    <CodeView
      backHref={backHref}
      header={
        <ToggleWrapper>
          <Toggle
            name="write"
            onClick={handleToggleClick(Tab.Write)}
            isActive={tab === Tab.Write}
          >
            Write
          </Toggle>
          <Toggle
            name="draw"
            onClick={handleToggleClick(Tab.Draw)}
            isActive={tab === Tab.Draw}
          >
            Draw
          </Toggle>
        </ToggleWrapper>
      }
      instructions={
        tab === Tab.Draw ? 'Doodle a nickname for your contact.' : ''
      }
      content={
        <>
          {tab === Tab.Write && (
            <form
              css={css`
                padding: 22px 30px;
              `}
              id="input-nickname"
            >
              <UnderlineInput
                css={css`
                  font-size: inherit;
                  width: 100%;
                  text-align: center;
                `}
                type="text"
                onChange={handleChange}
                defaultValue={contact ? contact.moniker : ''}
                placeholder="Contact nickname"
                autoFocus
              />
            </form>
          )}
          {tab === Tab.Draw && (
            <div
              css={css`
                background: ${color.primary};
              `}
            >
              <ReactSketchCanvas
                css={css`
                  border: none;
                `}
                width="400"
                height="80"
                strokeWidth={4}
                strokeColor="white"
                canvasColor="none" // transparent
                ref={canvasRef}
              />
            </div>
          )}
        </>
      }
      message={errorMsg}
      footer={
        tab === Tab.Draw ? (
          <IconButton
            onClick={handleSaveNicknameDrawing}
            type="submit"
            form="input-nickname"
            icon={HatPerson}
          >
            Confirm nickname
          </IconButton>
        ) : (
          <IconButton
            onClick={handleSaveNicknameText}
            type="submit"
            form="input-nickname"
            icon={HatPerson}
            disabled={nickname.length === 0}
          >
            Confirm nickname
          </IconButton>
        )
      }
    />
  );
}
