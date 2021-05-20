/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import {
  TopBar,
  Button,
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  BackToHomeLink,
} from './';
import WormholePlaceholder from './images/WormholePlaceholder.png';
import { ContactId, Backchannel } from '../backend/types';

type Props = {
  contactId: ContactId;
  backchannel: Backchannel;
};

export default function Contact({ contactId, backchannel }: Props) {
  let [nickname, setNickname] = useState<string>('');
  let [errorMsg, setErrorMsg] = useState('');
  //eslint-disable-next-line
  let [_, setLocation] = useLocation();

  async function handleAddContact(e) {
    e.preventDefault();
    try {
      await backchannel.editMoniker(contactId, nickname);
      setLocation(`/mailbox/${contactId}`);
    } catch (err) {
      onError(err);
    }
  }

  function handleChange(event) {
    setErrorMsg('');
    setNickname(event.target.value);
  }

  let onError = (err: Error) => {
    console.error('got error from backend', err);
    setErrorMsg(err.message);
  };

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        background: url('${WormholePlaceholder}'); /* TODO wormhole animation */
        background-size: cover;
        background-position: center;
      `}
    >
      <TopBar
        css={css`
          background: none;
        `}
      >
        <BackToHomeLink />
      </TopBar>
      <ContentWithTopNav
        css={css`
          text-align: center;
          display: flex;
          flex-direction: column;
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
            <input
              css={css`
                font-size: inherit;
                width: 100%;
                text-align: center;
              `}
              type="text"
              onChange={handleChange}
              placeholder="Enter a nickname for your contact"
            ></input>
          </CodeDisplayOrInput>
          <BottomActions>
            <Button onClick={handleAddContact} type="submit">
              Add Contact
            </Button>
          </BottomActions>
        </form>
      </ContentWithTopNav>
    </div>
  );
}
