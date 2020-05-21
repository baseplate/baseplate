const Request = require('../../core/lib/http/request')

class ServerRequest extends Request {
  constructor(req, body) {
    const url = new URL(req.url, `http://${req.headers.host}`)

    super({
      body,
      headers: req.headers,
      method: req.method,
      url
    })
  }
}

module.exports = ServerRequest
