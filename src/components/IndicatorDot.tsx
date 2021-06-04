/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';
import { color } from './tokens';

export enum StatusType {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
}
type IndicatorDotProps = {
  status: StatusType;
} & React.ClassAttributes<HTMLDivElement> &
  React.HTMLAttributes<HTMLDivElement>;

export default function IndicatorDot({
  status = StatusType.DISCONNECTED,
  ...props
}: IndicatorDotProps) {
  return (
    <div
      css={css`
        height: 6px;
        width: 6px;
        border-radius: 50%;
        background: ${status === StatusType.CONNECTED
          ? color.indicatorOnline
          : color.indicatorOffline};
      `}
      {...props}
    ></div>
  );
}
