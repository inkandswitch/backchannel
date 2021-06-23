/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';

import { Button, TopBar, UnderlineInput, SettingsContent } from '.';
import { Page, ContentWithTopNav } from './';
import { Nickname } from './util';
import Backchannel from '../backend';
import { IContact, ContactId } from '../backend/types';

let backchannel = Backchannel();

type Props = {
  contactId: ContactId;
};

export default function ContactSettings(props: Props) {
  const [contact, setContact] = useState<IContact>(
    backchannel.db.getContactById(props.contactId)
  );
  const [nickname, setNickname] = useState<string>();
  //eslint-disable-next-line
  let [_, setLocation] = useLocation();

  async function updateNickname(e) {
    e.preventDefault();
    try {
      const updatedContact = await backchannel.editMoniker(
        contact.id,
        nickname
      );
      setContact(updatedContact);
    } catch (err) {
      onError(err);
    }
  }

  const onError = (err: Error) => {
    console.error('got error from backend', err);
  };

  function handleChange(e) {
    setNickname(e.target.value);
  }

  async function handleContactDelete(e) {
    e.preventDefault();
    if (
      window.confirm(
        'Permanently delete this contact? The messages will be gone forever.'
      )
    ) {
      await backchannel.deleteContact(contact.id);
      setLocation(`/`);
    }
  }

  return (
    <Page align="center">
      <TopBar
        title={<Nickname contact={contact} />}
        backHref={`/mailbox/${contact.id}`}
      />
      <ContentWithTopNav>
        <SettingsContent
          css={css`
            max-width: unset;
          `}
        >
          <form id="contact-info">
            <UnderlineInput
              onChange={handleChange}
              defaultValue={contact.moniker}
              placeholder="Contact nickname"
              autoFocus
            />
          </form>
          <Button type="submit" onClick={updateNickname} form="contact-info">
            Save
          </Button>
          <Button onClick={handleContactDelete} variant="destructive">
            Delete Contact
          </Button>
        </SettingsContent>
      </ContentWithTopNav>
    </Page>
  );
}
