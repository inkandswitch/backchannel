import Backchannel, { EVENTS } from 'backchannel';
import { Buffer } from 'buffer';
import randomBytes from 'randombytes';

const DBNAME = 'bc-example'

// user-defined settings, we provide a default.
const SETTINGS = {
	relay: 'ws://localhost:3001'
}
let backchannel = new Backchannel(DBNAME, SETTINGS)
backchannel.once(EVENTS.OPEN, () => {
	setTimeout(()=> {
		getCode()
	}, 60 * 1000)
	getCode()
})


let feedback = document.querySelector('#feedback')
let codeInput = document.querySelector('#my-code')

async function getCode() {
	let random = randomBytes(2)
	let code = parseInt(Buffer.from(random).toString('hex'), 16)
	codeInput.innerHTML = code

	try { 
		let [ mailbox, password ]  = splitCode(code)
		console.log('joining', mailbox, password)
		let key = await backchannel.accept(mailbox, password)
		let el = document.createElement('div')
		el.innerHTML = 'got a connection '  + key
		feedback.appendChild(el)
	} catch (err) {
		feedback.innerHTML = 'ERROR: ' + err.message
	}
	getCode()
	return 
}

function splitCode (code) {
	code = code.toString()
	let mailbox = 'myapp+' + code.slice(0, 2)
	let password = code.slice(2)
	return [mailbox, password]
}


document.querySelector('#redeem-code').onsubmit = async (e) => {
	e.preventDefault()
	let name = e.target[0]
	let input = e.target[1]
	let code = input.value

	try { 
		let [ mailbox, password ]  = splitCode(code)
		let key = await backchannel.accept(mailbox, password)
		let el = document.createElement('div')
		el.innerHTML = name.value + ' ' + key
		feedback.appendChild(el)
	} catch (err) {
		feedback.innerHTML = 'ERROR: ' + err.message
	}

	input.value = ''
	name.value = ''

}