/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react/macro';

import { color } from './tokens';
import Backchannel from '../backend';
import { ERROR } from '../backend/backchannel';

let backchannel = Backchannel();

export default function NetworkError() {
  let [relayError, setRelayError] = useState(null);
  let [retries, setRetries] = useState(0);

  useEffect(() => {
    function onError(err, code: ERROR) {
      switch (code) {
        case ERROR.UNREACHABLE:
          let ms = err.delay % 1000;
          let s = (err.delay - ms) / 1000;
          var secs = s % 60;
          let rest = 'Retrying...';
          if (secs > 1)
            rest = `Retrying in ${secs} seconds. (${retries} attempts)`;
          let message = `Failed to connect to anyone. ${rest}`;
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

    backchannel.on('error', onError);
    backchannel.on('server.connect', onServerConnect);

    return () => {
      backchannel.removeListener('error', onError);
      backchannel.removeListener('server.connect', onServerConnect);
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
