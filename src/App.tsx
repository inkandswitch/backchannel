import React, { useState }  from 'react';
import { Wormhole, Code } from './wormhole';
import { arrayToHex } from 'enc-utils';

let wormhole = new Wormhole((err) => {
  console.error(err)
})

// Amount of time to show immediate user feedback
let USER_FEEDBACK_TIMER = 5000;

const CodeView = () => {
  let [ code , setCode ] = useState("");
  let [ key, setKey ] = useState("");
  let [ generated , setGenerated ] = useState(false);
  let [ errorMsg, setErrorMsg] = useState("");

  let onError = (err: Error) => {
    console.error('got error from backend', err)
    setErrorMsg(err.message);
  }

  function handleChange (event) {
    setErrorMsg("");
    setCode(event.target.value)
  }

  function onClickRedeem () {
    wormhole.redeemCode(code)
      .then((wormhole: any) => {
        setErrorMsg("");
        console.log('got a secure connection to wormhole')
        setKey(arrayToHex(wormhole.key))
      })
      .catch((err: Error) => {
        onError(err)
      })
  }

  function onClickGenerate () {
    // When a new code is generated
    // no news is good news.
    setGenerated(true);
    setErrorMsg("");
    let filename = 'fakefilename.txt'

    // Reset the state after a certain amount of time
    setTimeout(() => {
      setGenerated(false);
    }, USER_FEEDBACK_TIMER);

    wormhole.generateCode(filename)
      .then((code: string) => {
        console.log('got code', code)
        setKey(code)
        setErrorMsg("");
        wormhole.factory.announce(code).then((connection) => {
          console.log('got a secure connection to wormhole')
          setKey(arrayToHex(connection.key))
          //backchannel.start(connection)
        })
      })
      .catch((err: Error) => {
        setGenerated(false);
        onError(err)
      })
  }

  return (
    <div>
      <h1>MAGIC WORMHOLE</h1>
      <div className="Hello">
        <button disabled={generated} onClick={onClickGenerate}>
            Generate
        </button>

        <input type="text" onChange={handleChange}></input>
        <button onClick={onClickRedeem}>
           Redeem 
        </button>
      </div>
      <div>{errorMsg}</div>
      <div className="Code">
        {generated && "Link copied!"}
        </div>
      <div className="Key">
        {key && key} 
      </div>
    </div>
  );
};

export default function App() {
  return (
    <CodeView />
  );
}
