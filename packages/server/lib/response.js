const Response = require('../../core/lib/http/response')

class ServerResponse extends Response {
  constructor(httpResponse) {
    super()

    this.httpResponse = httpResponse
  }

  send(body) {
    if (this.contentType) {
      this.httpResponse.setHeader('content-type', this.contentType)
    }

    this.httpResponse.writeHead(this.statusCode)
    this.httpResponse.end(body)
  }
}

module.exports = ServerResponse
