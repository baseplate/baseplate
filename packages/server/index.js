require('dotenv').config()

const handlerGraphQL = require('../core/handlers/graphql')
const handlerREST = require('../core/handlers/rest')
const Server = require('./lib/server')
const cors = require('./lib/cors')

const server = new Server()

server.use(cors)
server.use((req, res) => {
  if (req.method === 'post' && req.url.pathname === '/graphql') {
    return handlerGraphQL(req, res)
  }

  return handlerREST(req, res)
})

module.exports = server
