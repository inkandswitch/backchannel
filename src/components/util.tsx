/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';
import { IContact } from '../backend/types';
import { color } from './tokens';

export function timestampToDate(timestamp: string): string {
  const date = new Date(parseInt(timestamp));
  return date.toLocaleDateString();
}

export function Nickname({ contact }: { contact: IContact }) {
  if (contact.avatar) {
    return (
      <img
        alt={`nickname for contact ${contact.id}`}
        css={css`
          max-width: 200px;
        `}
        src={contact.avatar}
      />
    );
  }

  if (contact.moniker) {
    return <>contact.moniker</>;
  }

  // No nickname was ever assigned, show placeholder
  return (
    <span
      css={css`
        color: ${color.textSecondary};
        font-style: italic;
      `}
    >
      No name
    </span>
  );
}
