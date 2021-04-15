import React, { useState }  from 'react';
import { Code } from './wormhole';

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

  //window.wormhole.listContacts().then(console.log).catch(console.error)

  function handleChange (event) {
    console.log('change', event.target.value)
    setErrorMsg("");
    setCode(event.target.value)
  }

  function onClickRedeem () {
    window.wormhole.redeemCode(code)
      .then((wormhole) => {
        setErrorMsg("");
        console.log('got a secure connection to wormhole')
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

    window.wormhole.generateCode(filename)
      .then((code: string) => {
        console.log('got code', code)
        setKey(code)
        setErrorMsg("");
        window.wormhole.factory.announce(code).then((wormhole) => {
          console.log('got a secure connection to wormhole')
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
