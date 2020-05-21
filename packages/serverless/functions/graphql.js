const handlerGraphQL = require('../../core/handlers/graphql')
const ServerlessRequest = require('../lib/http/request')
const ServerlessResponse = require('../lib/http/response')

module.exports.post = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  const req = new ServerlessRequest(event)
  const res = new ServerlessResponse(callback)

  handlerGraphQL(req, res)
}
