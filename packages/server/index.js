require('dotenv').config()

const {handlerGraphQL, handlerRest} = require('@baseplate/postgres')
const Server = require('./lib/server')
const cors = require('./lib/cors')

const server = new Server()

server.use(cors)
server.use((req, res) => {
  if (req.method === 'post' && req.url.pathname === '/graphql') {
    return handlerGraphQL(req, res)
  }

  return handlerRest(req, res)
})

module.exports = server
