import { useEffect, useState } from 'react';

import { Code, CodeType } from '../backend/types';

import Backchannel from '../backend';
import { generateQRCode } from '../web';
import useCountdown from '../hooks/useCountdown';
import usePrevious from '../hooks/usePrevious';

type QRCodeImage = string;

let backchannel = Backchannel();

/**
 * Get a connection code and its corresponding QR Code image string. Automatically refreshes every `refreshRateSec` seconds.
 *
 * @param {CodeType} codeType The code to accept
 * @param {number} timeout The refresh rate in seconds. Default is 60 seconds.
 * @returns {Code} An invite code.
 * @returns {QRCodeImage} Stringified image of a QR Code that accepts the invite code.
 */
export default function useCode(
  codeType: CodeType,
  timeout: number = 60,
  redeemUrlPath: string
): [code: Code, qrCode: QRCodeImage] {
  const [code, setCode] = useState('');
  const [qrCode, setQRCode] = useState('');
  const [timeRemaining, resetCountdown] = useCountdown(timeout);
  const previousCodeType = usePrevious(codeType);

  // Generate new code and reset countdown when timer runs out
  // or if the codeType changes
  useEffect(() => {
    if (timeRemaining === 0 || previousCodeType !== codeType) {
      // Clear the code before getting a new one so
      // stale codes don't linger
      setCode('');
      setQRCode('');

      getCode(codeType).then((code) => {
        setCode(code);
        const url = getReedemURL(redeemUrlPath, code);
        console.log('REDEEM URL', url);
        generateQRCode(url).then((qrCode) => setQRCode(qrCode));
        resetCountdown();
      });
    }
  }, [
    timeRemaining,
    codeType,
    previousCodeType,
    resetCountdown,
    redeemUrlPath,
  ]);

  return [code, qrCode];
}

const getCode = async (codeType): Promise<Code> => {
  try {
    let code: Code;
    switch (codeType) {
      case CodeType.WORDS:
        code = await backchannel.getCode();
        return code;
      case CodeType.NUMBERS:
        code = await backchannel.getNumericCode();
        return code;
    }
  } catch (err) {
    if (err.message.startsWith('This code has expired')) {
      // TODO differentiate between an actual backend err (which should be displayed) vs the code timing out (which should happen quietly).
    } else {
      console.error('got error from backend', err);
    }
  }
};

// `urlPath` should have a leading slash, e.g. `/redeem`
function getReedemURL(urlPath, code) {
  return `${window.location.origin}${urlPath}#${code.replaceAll(' ', '-')}`;
}
