require('dotenv').config()

const http = require('http')

const handlerGraphQL = require('../core/handlers/graphql')
const handlerREST = require('../core/handlers/rest')
const ServerRequest = require('./lib/request')
const ServerResponse = require('./lib/response')

const requestHandler = (rawRequest, rawResponse) => {
  let body = ''

  rawRequest.on('data', chunk => {
    body += chunk.toString()
  })

  rawRequest.on('end', () => {
    const request = new ServerRequest(rawRequest, body)
    const response = new ServerResponse(rawResponse)

    if (request.method === 'post' && request.url.pathname === '/graphql') {
      return handlerGraphQL(request, response)
    }

    return handlerREST(request, response)
  })
}

const server = http.createServer(requestHandler)

module.exports.start = ({host = 'localhost', port = '8123'} = {}) => {
  return new Promise((resolve, reject) => {
    server.listen(port, host, error => {
      if (error) return reject(error)

      console.log(
        `[ @baseplate/server ] Server running at http://${host}:${port}`
      )

      resolve()
    })
  })
}
