class EndpointResponse {
  constructor(callback) {
    this.callback = callback
    this.statusCode = 200
  }

  json(data) {
    const body = JSON.stringify(data)

    return this.send(body)
  }

  send(body) {
    this.callback(null, {
      body,
      statusCode: this.statusCode
    })
  }

  status(statusCode) {
    this.statusCode = statusCode

    return this
  }
}

module.exports = EndpointResponse
