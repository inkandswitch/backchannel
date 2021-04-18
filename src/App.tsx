import React, { useState }  from 'react';
import { Backchannel, Contact } from './backchannel'

let backchannel = new Backchannel()

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

  async function onClickRedeem () {
    try { 
      let contact = await backchannel.accept(code)
      setErrorMsg("");
      console.log('got a secure connection to wormhole')
      setKey(contact.key)
    } catch (err)  {
      onError(err)
    }
  }

  async function onClickGenerate () {
    // When a new code is generated
    // no news is good news.
    setGenerated(true);
    setErrorMsg("");

    // Reset the state after a certain amount of time
    setTimeout(() => {
      setGenerated(false);
    }, USER_FEEDBACK_TIMER);

    try { 
      let code = await backchannel.getCode()
      console.log('got code', code)
      setKey(code)
      setErrorMsg("");
      let contact = await backchannel.announce(code)
      setKey(contact.key)
    } catch (err) {
      setGenerated(false);
      onError(err)
    }
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
