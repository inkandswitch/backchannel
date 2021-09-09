import Backchannel, { EVENTS } from 'backchannel';
import { Buffer } from 'buffer';
import randomBytes from 'randombytes';

let feedback = document.querySelector('#feedback')
let contactsDiv = document.querySelector('#contacts')
let codeInput = document.querySelector('#my-code')


// system-defined settings for database location
const DBNAME = 'bc-example'

// user-defined settings, we provide a default.
const SETTINGS = {
	relay: 'ws://localhost:3001'
}
let backchannel = new Backchannel(DBNAME, SETTINGS)
backchannel.once(EVENTS.OPEN, () => {
	generateCode()

	setTimeout(()=> {
		generateCode()
	}, 60 * 1000)

	let contacts = backchannel.listContacts()
	contacts.forEach(addToContactDOM)
})

function addToContactDOM (contact) {
	let el = document.createElement('div')
	el.innerHTML = `${contact.id} : ${contact.name || 'NO NAME	'}`
	contactsDiv.appendChild(el)
}

async function generateCode() {
	let random = randomBytes(3)
	let code = parseInt(Buffer.from(random).toString('hex'), 16)
	codeInput.innerHTML = code

	try { 
		let [ mailbox, password ]  = splitCode(code)
		let key = await backchannel.accept(mailbox, password)
		let id = await backchannel.addContact(key)
		let contact = await backchannel.contacts.find(c => c.id === id)
		addToContactDOM(contact)
	} catch (err) {
		feedback.innerHTML = 'ERROR: ' + err.message
	}
	generateCode()
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
		let id = await backchannel.addContact(key)
		let contact = await backchannel.editName(id, name.value)
		addToContactDOM(contact)
	} catch (err) {
		feedback.innerHTML = 'ERROR: ' + err.message
	}

	input.value = ''
	name.value = ''

}