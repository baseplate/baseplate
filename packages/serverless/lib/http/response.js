const Response = require('../../../core/lib/http/response')

class ServerlessResponse extends Response {
  constructor(callback) {
    super()

    this.callback = callback
  }

  send(body) {
    this.callback(null, {
      body,
      statusCode: this.statusCode
    })
  }
}

module.exports = ServerlessResponse
