# Backchannel

[![Netlify Status](https://api.netlify.com/api/v1/badges/b91ac61c-abc1-40d0-9563-e05c189190ae/deploy-status)](https://app.netlify.com/sites/gallant-lewin-1c93b0/deploys) [![CI](https://github.com/inkandswitch/backchannel/actions/workflows/ci.yml/badge.svg)](https://github.com/inkandswitch/backchannel/actions)


Backchannel is a cross platform progressive web application combining novel
out-of-band identity verification techniques with a modernised pet name address book system. 

This prototype will allow two people to share documents safely over time in
a cohesive, easily understood interface. It will satisfy certain
cases of heightened risk without dramatic configuration or expertise required
on behalf of network participants.

## Getting started

* [Read the API docs](https://6088af8c57be4400073fe25d--gallant-lewin-1c93b0.netlify.app/docs/api/)
* [Contributing & Code of Conduct](docs/contributing.md)

```
npm install
```

The websocket relay must be run in the background in a separate terminal.

```
npm run relay
```

Then, you can build the javascript bundle which includes hotreloading.

```
npm start
```

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

# License

MIT
