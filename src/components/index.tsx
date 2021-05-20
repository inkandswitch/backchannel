/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';
import { Link } from 'wouter';

import { color } from './tokens';

export function TopBar(props) {
  return (
    <div
      css={css`
        background: ${color.primary};
        color: ${color.chatHeaderText};
        text-align: center;
        padding: 18px;
        position: fixed;
        width: 100%;
        display: flex;
        flex-direction: row;
      `}
      {...props}
    />
  );
}

export function BottomNav(props) {
  return (
    <div
      css={css`
        color: ${color.chatHeaderText};
        text-align: center;
        padding: 18px;
        position: fixed;
        bottom: 0;
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        align-items: center;
      `}
      {...props}
    />
  );
}

export const ContentWithBottomNav = (props) => (
  <div
    css={css`
      padding-bottom: 100px;
      flex: 1 0 auto;
    `}
    {...props}
  />
);

export const ContentWithTopNav = (props) => (
  <div
    css={css`
      padding-top: 60px;
      flex: 1 0 auto;
    `}
    {...props}
  />
);

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
