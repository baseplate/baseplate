const {HttpRequest} = require('@baseplate/core')

class ServerRequest extends HttpRequest {
  constructor(req, body) {
    const url = new URL(req.url, `http://${req.headers.host}`)

    super({
      body,
      headers: req.headers,
      method: req.method,
      url,
    })
  }
}

module.exports = ServerRequest
