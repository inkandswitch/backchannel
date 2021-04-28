import React from 'react';
import { css } from '@emotion/react/macro';
import { Link } from 'wouter';

export function TopBar(props) {
  return (
    <div
      {...props}
      css={css`
        background: gray;
        text-align: center;
        padding: 16px 0;
      `}
    />
  );
}

export function A({ children, href, ...props }) {
  return (
    <Link
      href={href}
      {...props}
      css={css`
        display: inline-block;
        margin: 0 1em;
        background: white;
        color: black;
        text-decoration: none;
        padding: 2px 8px;
        border-radius: 5px;
      `}
    >
      {children}
    </Link>
  );
}

export function Button({ children, ...props }) {
  return (
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
}
