const {HttpResponse} = require('@baseplate/core')

class ServerResponse extends HttpResponse {
  constructor(httpResponse) {
    super()

    this.httpResponse = httpResponse
  }

  end() {
    return this.send()
  }

  send(body) {
    if (this.contentType) {
      this.httpResponse.setHeader('content-type', this.contentType)
    }

    this.httpResponse.writeHead(this.statusCode)
    this.httpResponse.end(body)
  }

  setHeader(name, value) {
    this.httpResponse.setHeader(name, value)
  }
}

module.exports = ServerResponse
