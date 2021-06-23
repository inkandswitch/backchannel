/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';
import IndicatorDot, { StatusType } from './IndicatorDot';
import { Nickname } from './util';

import { IContact } from '../backend/types';

type Props = {
  connected?: boolean;
  contact: IContact;
  hideIndicator?: boolean;
};

export default function TopBarNickname({
  connected = false,
  contact,
  hideIndicator = false,
}: Props) {
  return (
    <>
      <div
        css={css`
          display: flex;
          flex-direction: row;
          align-items: center;
        `}
      >
        <IndicatorDot
          css={css`
            margin-right: 6px;
            opacity: ${hideIndicator ? 0 : 1};
          `}
          status={connected ? StatusType.CONNECTED : StatusType.DISCONNECTED}
        />
        <Nickname contact={contact} />
      </div>
    </>
  );
}
