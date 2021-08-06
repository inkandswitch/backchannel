const { Server } = require('@localfirst/relay/dist')

const DEFAULT_PORT = 3001 
const port = Number(process.env.PORT) || DEFAULT_PORT

const server = new Server({ port })

server.listen()
