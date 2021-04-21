import React, { useState }  from 'react';
import { copyToClipboard } from './web'
import { Backchannel } from './backchannel'
import { ContactId } from './db'

let dbName = "backchannel_" + window.location.hash
console.log(dbName)
let backchannel = new Backchannel(dbName)

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
    console.log('on click redeem')
    try { 
      let contact_id: ContactId = await backchannel.accept(code)
      setErrorMsg("");
      console.log('got a contact')
    } catch (err)  {
      onError(err)
    }
  }

  async function onClickGenerate () {
    // When a new code is generated
    // no news is good news.
    setGenerated(true);
    setErrorMsg("");

    // Reset after a certain amount of time
    setTimeout(() => {
      setGenerated(false);
    }, USER_FEEDBACK_TIMER);

    try { 
      let code = await backchannel.getCode()
      console.log('code copied to clipboard', code)
      setKey(code)
      setErrorMsg("");
      await copyToClipboard(code)
      let contact_id: ContactId = await backchannel.announce(code)
      console.log('got a contact')
    } catch (err) {
      setGenerated(false);
      onError(err)
    }
  }

  return (
    <div>
      <h1>Backchannel</h1>
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
