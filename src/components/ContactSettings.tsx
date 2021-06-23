/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { Link } from 'wouter';
import { useLocation } from 'wouter';

import { TopBar, SettingsContent } from '.';
import { Page, ContentWithTopNav, IconButton } from './';
import TopBarNickname from './TopBarNickname';
import Backchannel from '../backend';
import { IContact, ContactId } from '../backend/types';
import { ReactComponent as PersonSmall } from '../components/icons/PersonSmall.svg';
import { ReactComponent as HatPerson } from '../components/icons/HatPerson.svg';
import { ReactComponent as ExportSmall } from '../components/icons/ExportSmall.svg';

let backchannel = Backchannel();

type Props = {
  contactId: ContactId;
};

export default function ContactSettings(props: Props) {
  const [contact] = useState<IContact>(
    backchannel.db.getContactById(props.contactId)
  );
  let [, setLocation] = useLocation();

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
        title={<TopBarNickname contact={contact} hideIndicator />}
        backHref={`/mailbox/${contact.id}`}
      />
      <ContentWithTopNav>
        <SettingsContent>
          <Link href={`/contact/${contact?.id}/edit`}>
            <IconButton icon={HatPerson}>Edit Nickname</IconButton>
          </Link>
          <IconButton
            onClick={handleContactDelete}
            variant="destructive"
            icon={PersonSmall}
          >
            Delete Contact
          </IconButton>
          <IconButton disabled variant="transparent" icon={ExportSmall}>
            Export message history
          </IconButton>
        </SettingsContent>
      </ContentWithTopNav>
    </Page>
  );
}
