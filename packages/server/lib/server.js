const http = require('http')
const ServerRequest = require('./request')
const ServerResponse = require('./response')

class Server {
  constructor() {
    this.handlers = []
    this.http = this.createServer()
  }

  createServer() {
    return http.createServer((rawRequest, rawResponse) => {
      let body = ''

      rawRequest.on('data', chunk => {
        body += chunk.toString()
      })

      rawRequest.on('end', () => {
        const request = new ServerRequest(rawRequest, body)
        const response = new ServerResponse(rawResponse)

        return this.getNextHandler(request, response)
      })
    })
  }

  getNextHandler(req, res, index = 0) {
    const handler =
      this.handlers[index] || ((req, res) => res.status(404).end())

    return handler(
      req,
      res,
      this.getNextHandler.bind(this, req, res, index + 1)
    )
  }

  start({host, port} = {}) {
    return new Promise((resolve, reject) => {
      this.http.listen(port, host, error => {
        if (error) return reject(error)

        console.log(
          `[ @baseplate/server ] Server running at http://${host}:${port}`
        )

        resolve()
      })
    })
  }

  use(handler) {
    this.handlers.push(handler)

    return this
  }
}

module.exports = Server
