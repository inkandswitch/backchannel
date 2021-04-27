/** @jsx jsx */
import React, { useState, useEffect } from 'react';
import { jsx, css } from '@emotion/react';
import { Link, Route, useLocation } from 'wouter';

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
    <Link href={href} {...props}>
      <a
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
      </a>
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
