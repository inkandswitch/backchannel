/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';
import CanvasDraw from 'react-canvas-draw';
import crypto from 'crypto';

import {
  Button,
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
} from './';
import { color } from './tokens';
import WormholePlaceholder from './images/WormholePlaceholder.png';
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
    let drawingId = crypto.randomBytes(4).toString();
    console.log('drawingID', drawingId);

    var img = canvasRef.current.getSaveData();
    localStorage.setItem(`saved-drawing-${drawingId}`, img);
    const contact = await backchannel.editMoniker(contactId, drawingId);
    setContact(contact);
    canvasRef.current.clear();
    // TODO
    // setLocation(`/mailbox/${contactId}`);
  }

  useEffect(() => {
    backchannel.connectToContactId(contactId);
  }, [contactId]);

  async function handleSaveNicknameText(e) {
    e.preventDefault();
    try {
      const contact = await backchannel.editMoniker(contactId, nickname);
      setContact(contact);
      // TODO
      // setLocation(`/mailbox/${contactId}`);
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
  console.log('my name is', contact?.moniker);

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
        title={
          contact ? (
            <CanvasDraw
              disabled
              saveData={localStorage.getItem(
                `saved-drawing-${contact.moniker}`
              )}
              canvasWidth={100}
              canvasHeight={40}
              hideGrid
              style={{
                boxShadow:
                  '0 13px 27px -5px rgba(50, 50, 93, 0.25),    0 8px 16px -8px rgba(0, 0, 0, 0.3)',
              }}
            />
          ) : (
            ''
          )
        }
      />
      <ContentWithTopNav
        css={css`
          text-align: center;
        `}
      >
        <Message>{errorMsg}</Message>
        <Instructions></Instructions>
        <form
          css={css`
            display: flex;
            flex-direction: column;
          `}
        >
          <CodeDisplayOrInput>
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
              <div
                css={css`
                  background: white;
                  padding: 50px 30px;
                `}
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
                  placeholder="Contact nickname"
                  autoFocus
                />
              </div>
            )}
            {view === 'draw' && (
              <div
                css={css`
                  background: white;
                `}
              >
                <CanvasDraw
                  ref={canvasRef}
                  canvasWidth={400}
                  canvasHeight={80}
                  brushRadius={4}
                />{' '}
              </div>
            )}
          </CodeDisplayOrInput>
          <BottomActions>
            <Button
              onClick={
                view === 'write'
                  ? handleSaveNicknameText
                  : handleSaveNicknameDrawing
              }
              type="submit"
            >
              Confirm nickname
            </Button>
          </BottomActions>
        </form>
      </ContentWithTopNav>
    </Page>
  );
}
