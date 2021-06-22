/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';

import {
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  Page,
  TopBar,
  Spinner,
} from '.';

export default function DeviceCodeView({
  header = null,
  instructions = null,
  content = null,
  message = null,
  footer = null,
}) {
  return (
    <Page>
      <TopBar>
        {header}
        <div
          css={css`
            width: 50px;
          `}
        />
      </TopBar>
      <ContentWithTopNav>
        {instructions && <Instructions>{instructions}</Instructions>}
        <CodeDisplayOrInput>{content}</CodeDisplayOrInput>
        <BottomActions
          css={css`
            min-height: 76px;
          `}
        >
          <Message>{message}</Message>
          {footer}
        </BottomActions>
      </ContentWithTopNav>
    </Page>
  );
}

export const DeviceCodeLoading = () => <DeviceCodeView content={<Spinner />} />;
