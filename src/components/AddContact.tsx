/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { css } from '@emotion/react/macro';
import { useLocation } from 'wouter';
import jsQR from 'jsqr';

import { copyToClipboard, generateQRCode } from '../web';
import {
  Button,
  ContentWithTopNav,
  Instructions,
  CodeDisplayOrInput,
  BottomActions,
  Message,
  UnderlineInput,
  Page,
  Spinner,
  IconWithMessage,
  TopBar,
  Toggle,
  ToggleWrapper,
  IconButton,
} from '../components';
import { Key, Code, ContactId } from '../backend/types';
import { color } from '../components/tokens';
import { ReactComponent as Copy } from './icons/Copy.svg';
import { ReactComponent as People } from './icons/People.svg';
import { ReactComponent as Checkmark } from './icons/Checkmark.svg';
import Backchannel from '../backend';

// Amount of milliseconds to show immediate user feedback
const USER_FEEDBACK_TIMER = 5000;
// Amount of seconds the user has to share code before it regenerates
const CODE_REGENERATE_TIMER_SEC = 60;

type CodeViewMode = 'redeem' | 'generate';
enum CodeType {
  WORDS = 'words',
  NUMBERS = 'numbers',
  QRCODE = 'qrcode',
}
enum AnimationMode {
  None = 0,
  Connecting = 1,
  Connected = 2,
  Redirecting = 3,
}
let backchannel = Backchannel();

type Props = {
  view: CodeViewMode;
  object: string;
};

export default function AddContact({ view, object }: Props) {
  let [code, setCode] = useState<Code>('');
  let [codeType, setCodeType] = useState<CodeType>(CodeType.WORDS);
  let previousCodeType = usePrevious(codeType);
  let [message, setMessage] = useState('');
  let [errorMsg, setErrorMsg] = useState('');
  let [qrCode, setQrCode] = useState<string>('');
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [animationMode, setAnimationMode] = useState<AnimationMode>(
    AnimationMode.None
  );
  const [timeRemaining, resetTimer] = useCountdown(CODE_REGENERATE_TIMER_SEC);
  //eslint-disable-next-line
  let [location, setLocation] = useLocation();

  let sharable = navigator.share;

  // Set user feedback message to disappear if necessary
  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => {
        setMessage('');
      }, USER_FEEDBACK_TIMER);

      return () => clearTimeout(timeout);
    }
  }, [message]);

  let onError = (err: Error) => {
    console.error('got error from backend', err);
    setAnimationMode(AnimationMode.Connecting);
    setErrorMsg(err.message);
  };

  function handleChange(event) {
    setErrorMsg('');
    setCode(event.target.value);
  }

  // Generate a new code and wait for other party to enter the code.
  let generateCode = useCallback(async () => {
    // Clear the code before getting a new one so
    // stale codes don't linger
    setCode('');
    try {
      let code: Code;
      switch (codeType) {
        case CodeType.WORDS:
          code = await backchannel.getCode();
          setCode(code);
          setQrCode('');
          break;
        case CodeType.NUMBERS:
          code = await backchannel.getNumericCode();
          setCode(code);
          setQrCode('');
          break;
        case CodeType.QRCODE:
          code = await backchannel.getNumericCode();
          let url = getReedemURL(code);
          let qrCode = await generateQRCode(url);
          setQrCode(qrCode);
          break;
      }

      if (code) {
        setErrorMsg('');
      }
      // automatically start the connection and wait for other person to show up.
      let key: Key = await backchannel.accept(
        code,
        (CODE_REGENERATE_TIMER_SEC + 2) * 1000 // be permissive, give extra time to redeem after timeout ends
      );
      let cid: ContactId = await backchannel.addContact(key);
      setErrorMsg('');
      setAnimationMode(AnimationMode.Connected);
      setRedirectUrl(`/contact/${cid}/add`);
    } catch (err) {
      if (err.message.startsWith('This code has expired')) {
        // TODO differentiate between an actual backend err (which should be displayed) vs the code timing out (which should happen quietly).
      } else {
        console.error('got error from backend', err);
      }
    }
  }, [codeType]);

  // generate new code and reset countdown when timer runs out
  useEffect(() => {
    if (view === 'generate' && timeRemaining === 0) {
      generateCode();
      resetTimer();
    }
  }, [timeRemaining, generateCode, resetTimer, view]);

  // Move from one animation step to the next
  useEffect(() => {
    let timeoutId;
    switch (animationMode) {
      case AnimationMode.Connected:
        timeoutId = setTimeout(() => {
          setAnimationMode((mode) => mode + 1);
        }, 2000);
        return () => clearTimeout(timeoutId);
      case AnimationMode.Redirecting:
        timeoutId = setTimeout(() => {
          setLocation(redirectUrl);
        }, 3000);
        return () => clearTimeout(timeoutId);
    }
  }, [animationMode, redirectUrl, setLocation]);

  // generate new code and reset countdown when the code type changes
  // (including on initial page load)
  useEffect(() => {
    if (view === 'generate' && previousCodeType !== codeType) {
      generateCode();
      resetTimer();
    }
  }, [codeType, generateCode, view, previousCodeType, resetTimer]);

  async function onClickCopy() {
    const copySuccess = await copyToClipboard(code);
    if (copySuccess) {
      setMessage('Code copied!');
    }
  }

  let redeemCode = useCallback(
    async (code) => {
      if (animationMode === AnimationMode.Connecting) return;
      try {
        setAnimationMode(AnimationMode.Connecting);
        let key: Key = await backchannel.accept(code);
        if (object === 'device') {
          let deviceId: ContactId = await backchannel.addDevice(key);
          setErrorMsg('');
          setAnimationMode(AnimationMode.Connected);
          setRedirectUrl(`/device/${deviceId}`);
        } else {
          let cid: ContactId = await backchannel.addContact(key);
          setErrorMsg('');
          setAnimationMode(AnimationMode.Connected);
          setRedirectUrl(`/contact/${cid}/add`);
          const timeoutId = setTimeout(() => {}, 2400);
          return () => clearTimeout(timeoutId);
        }
      } catch (err) {
        console.log('got error', err);
        onError(err);
        setCode('');
      }
    },
    [animationMode, object, setRedirectUrl]
  );

  // attempt to redeem code if it's in the url hash
  useEffect(() => {
    if (view === 'redeem') {
      let maybeCode = window.location.hash;
      if (maybeCode.length > 1 && code !== maybeCode) {
        redeemCode(maybeCode.slice(1));
      }
    }
  }, [view, code, redeemCode]);

  // Enter backchannel from 'input' code view
  async function onClickRedeem(e) {
    e.preventDefault();
    await redeemCode(code);
  }

  function getReedemURL(code) {
    return `${window.location.origin}/redeem/contact#${code}`;
  }

  async function onClickShareURL() {
    let url = window.location.origin + '/redeem/contact';
    if (sharable) {
      navigator
        .share({
          title: 'Chat on backchannel',
          text: `I want to chat with you securely with you on Backchannel. Go to ${url} and use the following invitation code: 
          ${code}`,
        })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing', error));
    } else {
      const copySuccess = await copyToClipboard(url);
      if (copySuccess) {
        setMessage('Code copied!');
      }
    }
  }

  function onScanQRCode(value) {
    window.location.href = value
  }

  switch (animationMode) {
    case AnimationMode.Connecting:
      // Show connection loading page
      return (
        <Page>
          <TopBar />
          <ContentWithTopNav
            css={css`
              background: ${color.codeShareBackground};
            `}
          >
            <CodeDisplayOrInput>
              <IconWithMessage icon={Spinner} text="Connecting" />
            </CodeDisplayOrInput>
            <BottomActions
              css={css`
                height: 76px;
              `}
            />
          </ContentWithTopNav>
        </Page>
      );

    case AnimationMode.Connected:
      // Show successful connection message
      return (
        <Page>
          <TopBar />
          <ContentWithTopNav
            css={css`
              background: ${color.codeShareBackground};
            `}
          >
            <CodeDisplayOrInput>
              <IconWithMessage
                icon={Checkmark}
                text={`${
                  object === 'device' ? 'Device' : 'Correspondant'
                } found`}
              />
            </CodeDisplayOrInput>
            <BottomActions
              css={css`
                height: 76px;
              `}
            />
          </ContentWithTopNav>
        </Page>
      );
    case AnimationMode.Redirecting:
      // Redirect to the contact/device naming step
      return (
        <Page>
          <TopBar />
          <ContentWithTopNav
            css={css`
              background: ${color.codeShareBackground};
            `}
          >
            <CodeDisplayOrInput>
              <IconWithMessage icon={Spinner} text="Creating Secure Channel" />
            </CodeDisplayOrInput>
            <BottomActions
              css={css`
                height: 76px;
              `}
            />
          </ContentWithTopNav>
        </Page>
      );
  }

  return (
    <Page>
      <TopBar>
        {view === 'generate' && (
          <ToggleWrapper>
            <Toggle
              onClick={() => setCodeType(CodeType.WORDS)}
              isActive={codeType === CodeType.WORDS}
            >
              Via text
            </Toggle>
            <Toggle
              onClick={() => setCodeType(CodeType.NUMBERS)}
              isActive={codeType === CodeType.NUMBERS}
            >
              On a Call
            </Toggle>
            <Toggle
              onClick={() => setCodeType(CodeType.QRCODE)}
              isActive={codeType === CodeType.QRCODE}
            >
              In person
            </Toggle>
          </ToggleWrapper>
        )}
        {view === 'redeem' && (
          <ToggleWrapper>
            <Toggle
              onClick={() => setCodeType(CodeType.WORDS)}
              isActive={codeType === CodeType.WORDS}
            >
              Enter Invite
            </Toggle>
            <Toggle
              onClick={() => setCodeType(CodeType.QRCODE)}
              isActive={codeType === CodeType.QRCODE}
            >
              Scan Invite
            </Toggle>
          </ToggleWrapper>
        )}
        <div
          css={css`
            width: 50px;
          `}
        />
      </TopBar>
      <ContentWithTopNav
        css={css`
          background: ${color.codeShareBackground};
          text-align: center;
        `}
      >
        {view === 'generate' && (
          <React.Fragment>
            <Instructions>
              Share this temporary invite with the other party. Once used,
              you’ll be added as each other's contact.
            </Instructions>
            <CodeDisplayOrInput>
              {qrCode ? (
                <img src={qrCode} alt="Scan me with your camera" />
              ) : code ? (
                code
              ) : (
                <Spinner />
              )}
              <Message>{errorMsg}</Message>
            </CodeDisplayOrInput>
            <BottomActions>
              <Message>{message}</Message>
              {codeType !== CodeType.QRCODE && (
                <>
                  <IconButton
                    onClick={onClickCopy}
                    icon={Copy}
                    label="Copy invite"
                  />
                  {sharable && (
                    <Button
                      variant="transparent"
                      onClick={onClickShareURL}
                      css={css`
                        margin: 16px;
                        margin-bottom: 24px;
                      `}
                    >
                      Share
                    </Button>
                  )}
                </>
              )}
            </BottomActions>
          </React.Fragment>
        )}
        {view === 'redeem' && (
          <React.Fragment>
            <Instructions>
              Enter the invite you were given by the other party. You’ll be
              added as each other's contact.
            </Instructions>
            <CodeDisplayOrInput>
              {codeType === CodeType.QRCODE ? (
                <QRReader onFind={onScanQRCode} />
              ) : (
                <form id="code-input">
                  <UnderlineInput
                    value={code}
                    css={css`
                      font-size: inherit;
                      width: 100%;
                      text-align: center;
                    `}
                    placeholder="Enter the code"
                    onChange={handleChange}
                    autoFocus
                  />
                </form>
              )}
            </CodeDisplayOrInput>
            <BottomActions>
              <Message>{errorMsg || message}</Message>
              {codeType !== CodeType.QRCODE && (
                <IconButton
                  onClick={onClickRedeem}
                  icon={People}
                  label="Add contact"
                  form="code-input"
                  type="submit"
                  disabled={code.length === 0}
                />
              )}
            </BottomActions>
          </React.Fragment>
        )}
      </ContentWithTopNav>
    </Page>
  );
}

// Counts down the seconds starting from `durationSec` to 0.
function useCountdown(
  durationSec: number
): [timeRemaining: number, resetTimer: () => void] {
  const [timeRemaining, setTimeRemaining] = useState<number>(durationSec);

  useEffect(() => {
    const timerID = setInterval(() => {
      if (timeRemaining !== 0) {
        // Count down by one second if the timer is not already at 0
        setTimeRemaining((sec) => sec - 1);
      }
    }, 1000);

    return () => clearInterval(timerID);
  }, [timeRemaining, durationSec]);

  return [timeRemaining, () => setTimeRemaining(durationSec)];
}

function usePrevious(value) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef();
  // Store current value in ref
  useEffect(() => {
    ref.current = value;
  }, [value]); // Only re-run if value changes
  // Return previous value (happens before update in useEffect above)
  return ref.current;
}

interface QRReaderProps {
  onFind: Function;
}

enum QRState {
  LOADING = 'loading',
  ERROR = 'error',
  READY = 'ready',
}

const { requestAnimationFrame } = global;

class QRReader extends React.Component<QRReaderProps> {
  state: any;

  constructor(props) {
    super(props);
    this.state = {
      qrState: QRState.LOADING,
      video: null,
    };
    this.requestCamera = this.requestCamera.bind(this);
  }

  requestCamera() {
    let video = this.state.video;
    if (!video) {
      video = document.createElement('video');
      this.setState({ video });
    }
    const canvasElement = document.getElementById(
      'qrCanvas'
    ) as HTMLCanvasElement;
    const canvas = canvasElement.getContext('2d');

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        this.setState({ qrState: QRState.READY });
        video.play();
        requestAnimationFrame(tick);
      })
      .catch((err) => {
        console.error(err);
        this.setState({ qrState: QRState.ERROR });
      });

    const tick = () => {
      //@ts-ignore
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (this.state.loading) this.setState({ loading: false });
        canvasElement.height = video.videoHeight;
        canvasElement.width = video.videoWidth;
        canvas.drawImage(
          video,
          0,
          0,
          canvasElement.width,
          canvasElement.height
        );
        var imageData = canvas.getImageData(
          0,
          0,
          canvasElement.width,
          canvasElement.height
        );
        var code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code) {
          this.props.onFind(code.data);
        }
      }
      requestAnimationFrame(tick);
    };
  }
  componentDidMount() {
    this.requestCamera();
  }

  componentWillUnmount() {
    if (this.state.video) this.state.video.pause();
  }

  render() {
    let message;
    switch (this.state.qrState) {
      case QRState.LOADING:
        message = <Spinner />;
        break;
      case QRState.ERROR:
        message = (
          <>
            <span>
              Unable to access video stream. Please make sure you have a webcam
              enabled.
            </span>
            <div>
              <Button onClick={this.requestCamera}>Try Again</Button>
            </div>
          </>
        );
        break;
      default:
        message = null;
        break;
    }
    return (
      <div>
        {message}
        <canvas
          css={css`
            display: ${this.state.qrState === QRState.READY ? 'block' : 'none'};
            max-width: 100%;
          `}
          id="qrCanvas"
        />
      </div>
    );
  }
}
