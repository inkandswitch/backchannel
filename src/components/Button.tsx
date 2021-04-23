/** @jsx jsx */
import React, { useState } from 'react';
import { jsx, css } from '@emotion/react';

export default ({ children, ...props }) => (
  <button
    css={css`
      display: inline-block;
      margin: 0 1em;
      background: white;
      color: black;
      padding: 2px 8px;
      border-radius: 5px;
      font-size: inherit;
    `}
    {...props}
  >
    {children}
  </button>
);
