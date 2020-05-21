const handlerREST = require('../../core/handlers/rest')
const ServerlessRequest = require('../lib/http/request')
const ServerlessResponse = require('../lib/http/response')

module.exports.handler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  const req = new ServerlessRequest(event)
  const res = new ServerlessResponse(callback)

  handlerREST(req, res)
}
