/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';
import { Link } from 'wouter';
import { ReactComponent as ArrowLeft } from '../components/icons/ArrowLeft.svg';

import { color, fontSize } from './tokens';

export function TopBar(props) {
  return (
    <div
      css={css`
        background: ${color.primary};
        color: ${color.chatHeaderText};
        text-align: center;
        padding: 18px 0;
        position: absolute;
        top: 0;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
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
        padding: 18px 0;
        position: absolute;
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
      padding-top: 75px;
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

export const Instructions = (props) => (
  <div
    css={css`
      color: ${color.chatSecondaryText};
      font-size: ${fontSize[1]}px;
      margin: 18px 18px 0;
      flex: 0 0 auto;
    `}
    {...props}
  />
);

export const CodeDisplayOrInput = (props) => (
  <div
    css={css`
      color: ${color.textBold};
      font-size: ${fontSize[3]}px;
      font-family: monospace;
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin: 18px;
    `}
    {...props}
  />
);

export const BottomActions = (props) => (
  <div
    css={css`
      align-self: center;
      margin-bottom: 18px;
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
    `}
    {...props}
  />
);

export const Message = (props) => (
  <div
    css={css`
      height: 18px;
      margin: 16px 0;
      color: ${color.textBold};
    `}
    {...props}
  />
);

export const BackToHomeLink = (props) => (
  <div {...props}>
    <Link href="/">
      <ArrowLeft
        css={css`
          padding: 0 18px;
          cursor: pointer;
        `}
      />
    </Link>
  </div>
);

export const UnderlineInput = (props) => (
  <input
    css={css`
      font-size: inherit;
      width: 100%;
      text-align: center;
      background: none;
      box-sizing: border-box;
      border: 0;
      border-bottom: 2px solid ${color.border};
      color: white;
      font-family: monospace;
      padding: 2px 0;

      &:focus {
        outline: 0;
        border-bottom: 2px solid ${color.codeShareText};
        transition: 0.2s;
      }
      &::placeholder {
        font-style: italic;
      }
    `}
    type="text"
    {...props}
  />
);
