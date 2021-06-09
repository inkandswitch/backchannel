/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';

const TIMER_RADIUS = 6;

type TimerProps = {
  totalTimeSec: number;
  timeRemainingSec: number;
  showNumber?: boolean;
  radius?: number;
};

export default function TimerCircle({
  totalTimeSec,
  timeRemainingSec,
  showNumber = false,
  radius = TIMER_RADIUS,
}: TimerProps) {
  return (
    <>
      <svg
        css={css`
          width: ${radius * 2}px;
          height: ${radius * 2}px;
        `}
      >
        <path
          fill="none"
          stroke="white"
          strokeWidth={radius}
          d={describeArc(
            radius,
            radius,
            radius / 2,
            0,
            getArcDegFromTime(timeRemainingSec, totalTimeSec)
          )}
        />
      </svg>
      {showNumber && <div>{timeRemainingSec}s</div>}
    </>
  );
}

function describeArc(x, y, radius, startAngleDeg, endAngleDeg) {
  const start = getPointOnSvg(x, y, radius, endAngleDeg);
  const end = getPointOnSvg(x, y, radius, startAngleDeg);

  const isLargeArc = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';

  const d = [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    isLargeArc,
    0,
    end.x,
    end.y,
  ].join(' ');

  return d;
}

// https://stackoverflow.com/questions/5736398/how-to-calculate-the-svg-path-for-an-arc-of-a-circle
function getPointOnSvg(centerX, centerY, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY + radius * Math.sin(angleRad),
  };
}

const MAX_DEG = 360;
function getArcDegFromTime(timeLeftSec: number, totalTimeSec: number): number {
  return (timeLeftSec / totalTimeSec) * MAX_DEG;
}
