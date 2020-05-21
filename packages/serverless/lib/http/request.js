const Request = require('../../../core/lib/http/request')

class ServerlessRequest extends Request {
  constructor(event) {
    const url = new URL(event.path, `http://${event.headers.Host}`)
    const searchParameters = new URLSearchParams(event.queryStringParameters)

    url.search = searchParameters.toString()

    super({
      body: event.body,
      headers: event.headers,
      method: event.httpMethod,
      params: event.pathParameters,
      url
    })
  }
}

module.exports = ServerlessRequest
