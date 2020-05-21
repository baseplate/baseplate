class Response {
  constructor() {
    this.statusCode = 200
  }

  json(data) {
    const body = JSON.stringify(data)

    this.contentType = 'application/json'

    return this.send(body)
  }

  status(statusCode) {
    this.statusCode = statusCode

    return this
  }
}

module.exports = Response
