const {InvalidRequestBodyError} = require('../errors')
const URL = require('./url')

class EndpointRequest {
  constructor(event) {
    this.headers = event.headers
    this.method = event.httpMethod
    this.path = event.path
    this.params = event.pathParameters
    this.query = event.queryStringParameters
    this.url = new URL({
      path: this.path,
      pathParameters: this.params,
      queryParameters: this.query
    })

    let body = event.body

    if (event.headers['Content-Type'] === 'application/json') {
      try {
        body = JSON.parse(body)
      } catch (error) {
        throw new InvalidRequestBodyError({
          expectedType: event.headers['Content-Type']
        })
      }
    }

    this.body = body
  }
}

module.exports = EndpointRequest
