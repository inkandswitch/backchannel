# Backchannel

THIS IS A PROOF OF CONCEPT PROTOTYPE. IT HAS NOT HAD ANY KIND OF SECURITY OR
CRYPTOGRAPHY REVIEW. THIS SOFTWARE MIGHT BE UNSAFE.

[![Netlify Status](https://api.netlify.com/api/v1/badges/b91ac61c-abc1-40d0-9563-e05c189190ae/deploy-status)](https://app.netlify.com/sites/gallant-lewin-1c93b0/deploys) [![CI](https://github.com/inkandswitch/backchannel/actions/workflows/ci.yml/badge.svg)](https://github.com/inkandswitch/backchannel/actions)

## Application prototypes

* [Backchat](https://github.com/inkandswitch/backchat)
* [Here](https://github.com/inkandswitch/here)
* [Simple example](example/index.js)

## Usage

This library is intended for use in a browser-like environment (progressive web app and electron would work too) as a websocket client. 

```
npm install backchannel
```

Backchannel depends upon [@local-first/relay](https://github.com/local-first-web/relay), which is a websocket relay. Clients need to connect to the same relay in order to find each other. You can run the relay either on the local machine or in the cloud. One way to do this in the cloud quickly is to [remix it on Glitch](https://glitch.com/edit/#!/import/github/local-first-web/relay-deployable).

You can use the relay provided in this repository at [bin/server.js](bin/server.js):

```js
const { Server } = require('@localfirst/relay/dist')

const DEFAULT_PORT = 3001 
const port = Number(process.env.PORT) || DEFAULT_PORT

const server = new Server({ port })

server.listen()
```

And run it with

```bash
$ node bin/server.js
```

### Basics 

Get a list of contacts

```js
import Backchannel, { EVENTS } from 'backchannel';

const DBNAME = 'myapp'
const SETTINGS = {
  relay: 'ws://localhost:3001'
}
let backchannel = new Backchannel(DBNAME, SETTINGS)
backchannel.once(EVENTS.OPEN, () => {
	let contacts = backchannel.listContacts()
})
```

Two users decide upon a single number that is at least 6 characters long OR generate a one-time invitation code for them:

```js
let code = parseInt(Buffer.from(random).toString('hex'), 16)
```


Once both users have entered in a code, split the code into 'mailbox' and
'password' pieces. The password should be kept secret! The mailbox is public to
the relay and so should not be derivative or in any way related to the password.

```js
let mailbox = code.slice(0, 3)
let password = code.slice(3)
let key = await backchannel.accept(mailbox, password)
```

Add a contact and assign them a name and avatar

```js
let id = await backchannel.addContact(key)
await backchannel.editName(id, 'jennie')
await backchannel.editAvatar(id, [avatarbytes])
```

Send an end to end encrypted message

```js
let message = await backchannel.sendMessage(id, 'hi jennie')
```

Link a device, this works the same as adding a contact, but you call addDevice instead
```js
let key = await backchannel.accept(mailbox, password)
let id = await backchannel.addDevice(key)
```

Unlink all devices

```js
backchannel.on(EVENTS.ACK, ({ contactId }) => {
  console.log('Unlinked device with id=', contactId)
})
await backchannel.unlinkDevice()
```

## Contributing

* [API documentation](https://gallant-lewin-1c93b0.netlify.app/docs/api/)
* [Contributing & Code of Conduct](docs/contributing.md)


## Viewing the Documentation

The docs can be auto-generated locally. The following command outputs the generated documentation into
`build/docs/api`. 

```
npm run build:docs
```

Then you can view the docs locally with an http-server, you can use something
like the node `http-server`.

```
npm i -g http-server
http-server build/docs/api
```

Or with npx:

```
npx http-server build/docs/api
```

You can then view the main documentation locally at http://localhost:port/classes/backend_backchannel.backchannel.html


## Testing

Open two browser windows that are not in private browsing mode. They can be
tabs in the same browser program. Opening a private window doesn't work with
IndexedDB.

Because we're using IndexedDB, to do local testing with the same browser on the
same machine, you should open one of the tabs or windows at
```localhost:3000``` and the other at ```127.0.0.1:3000```. This will ensure
that they both have their own isolated database.

To run automated tests, 

```
npm run relay
```

and then

```
npm test
```

## Deployment

To deploy the minified production build, run

```npm run build```

To build the api documentation, run

```npm run build:docs```

To build both the production build and the docs for deployment on a static
server, run

```npm run deploy```

## Contributors

* Karissa McKelvey, @okdistribute, Lead 
* Ben Royer, Design
* Chris Sun, @daiyi, Frontend/UI

## Advisors

* [Cade Diehm](https://shiba.computer/)
* Peter van Hardenberg, @pvh
* سلمان الجماز, @saljam
* Herb Caudill, @herbcaudill
* Martin Kleppman, @ept

# License

MIT
