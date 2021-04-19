import React, { useState }  from 'react';
import { copyToClipboard } from './web'
import { Backchannel, Contact } from './backchannel'

let dbName = "backchannel_" + window.location.hash
console.log(dbName)
let backchannel = new Backchannel(dbName)
let contact = null

// temp haxx0rs.
function doTheThing (contact) {
  console.log('connected')
  console.log('joining document', contact.metadata.key)
  backchannel.joinDocument(contact.metadata.key)
}

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
      contact = await backchannel.accept(code)
      setErrorMsg("");
      console.log('got a secure connection to wormhole')
      setKey(contact.key)
    } catch (err)  {
      onError(err)
    }

    doTheThing(contact)
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
      contact = await backchannel.announce(code)
      console.log('got a secure connection to wormhole')
      setKey(contact.key)
    } catch (err) {
      setGenerated(false);
      onError(err)
    }

    doTheThing(contact)
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
