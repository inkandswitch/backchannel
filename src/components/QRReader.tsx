/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react/macro';
import jsQR from 'jsqr';

import { Button, Spinner } from '.';

interface QRReaderProps {
  onFind: Function;
}

enum QRState {
  LOADING = 'loading',
  ERROR = 'error',
  READY = 'ready',
}

const { requestAnimationFrame } = global;

export default class QRReader extends React.Component<QRReaderProps> {
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
            <div
              css={css`
                margin-bottom: 20px;
              `}
            >
              Unable to access video stream. Please make sure you have a webcam
              enabled.
            </div>
            <Button onClick={this.requestCamera}>Try Again</Button>
          </>
        );
        break;
      default:
        message = null;
        break;
    }
    return (
      <>
        {message}
        <canvas
          css={css`
            display: ${this.state.qrState === QRState.READY ? 'block' : 'none'};
            max-width: 100%;
          `}
          id="qrCanvas"
        />
      </>
    );
  }
}
