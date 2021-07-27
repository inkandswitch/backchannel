/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';

import { color } from './tokens';
import Backchannel, { EVENTS, ERROR } from '../backend';

let backchannel = Backchannel();

export default function NetworkError() {
  let [relayError, setRelayError] = useState(null);
  let [retries, setRetries] = useState(0);

  useEffect(() => {
    function onError(err, code: ERROR) {
      switch (code) {
        case ERROR.UNREACHABLE:
          const ms = err.delay % 1000;
          const s = (err.delay - ms) / 1000;
          const secs = s % 60;
          let rest = 'Retrying...';
          if (secs > 1)
            rest = `Retrying in ${secs} seconds. (${retries} attempts)`;
          const message = `Failed to connect to the Relay. ${rest}`;
          setRelayError(message);
          setRetries(retries + 1);
          break;
        case ERROR.PEER:
          // TODO: do something
          break;
        default:
          break;
      }
      console.error(err);
    }

    function onServerConnect() {
      if (relayError) {
        setRelayError(null);
        setRetries(0);
      }
    }

    backchannel.on(EVENTS.ERROR, onError);
    backchannel.on(EVENTS.RELAY_CONNECT, onServerConnect);

    return () => {
      backchannel.removeListener(EVENTS.ERROR, onError);
      backchannel.removeListener(EVENTS.RELAY_CONNECT, onServerConnect);
    };
  });

  return relayError ? (
    <div
      css={css`
        color: ${color.errorText};
        background-color: ${color.errorBackground};
        text-align: center;
        padding: 18px 0px;
      `}
    >
      {relayError}
    </div>
  ) : null;
}
