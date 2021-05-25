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
  UnderlineInput,
  Page,
} from './';
import { color } from './tokens';
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
              />
            </div>
          </CodeDisplayOrInput>
          <BottomActions>
            <Button onClick={handleAddContact} type="submit">
              Add Contact
            </Button>
          </BottomActions>
        </form>
      </ContentWithTopNav>
    </Page>
  );
}
