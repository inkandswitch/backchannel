# Backchannel

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
