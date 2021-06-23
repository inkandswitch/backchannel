/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';

import { color } from './tokens';

import {
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  Page,
  TopBar,
  IconWithMessage,
  Spinner,
} from '.';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';

export default function CodeView({
  header = null,
  instructions = null,
  content = null,
  message = null,
  footer = null,
}) {
  return (
    <Page
      css={css`
        background: ${color.codeShareBackground};
      `}
    >
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

export enum AnimationMode {
  None = 0,
  Connecting = 1,
  Connected = 2,
  CreatingChannel = 3,
  Redirect = 4,
}

export function useAnimation(): [
  animationMode: AnimationMode,
  setAnimationMode: React.Dispatch<React.SetStateAction<AnimationMode>>
] {
  const [animationMode, setAnimationMode] = useState<AnimationMode>(
    AnimationMode.None
  );

  // Move from one animation step to the next
  useEffect(() => {
    let timeoutId;
    switch (animationMode) {
      case AnimationMode.Connected:
        timeoutId = setTimeout(() => {
          setAnimationMode((mode) => mode + 1);
        }, 2000);
        return () => clearTimeout(timeoutId);
      case AnimationMode.CreatingChannel:
        timeoutId = setTimeout(() => {
          setAnimationMode((mode) => mode + 1);
        }, 3000);
        return () => clearTimeout(timeoutId);
    }
  }, [animationMode]);

  return [animationMode, setAnimationMode];
}

export function codeViewAnimation(animationMode: AnimationMode) {
  switch (animationMode) {
    case AnimationMode.Connecting:
      // Show connection loading page
      return (
        <CodeView
          content={<IconWithMessage icon={Spinner} text="Connecting" />}
        />
      );

    case AnimationMode.Connected:
      // Show successful connection message
      return (
        <CodeView
          content={
            <IconWithMessage icon={Checkmark} text="Correspondent found" />
          }
        />
      );

    case AnimationMode.CreatingChannel:
      return (
        <CodeView
          content={
            <IconWithMessage icon={Spinner} text="Creating Secure Channel" />
          }
        />
      );
  }
  return null;
}
