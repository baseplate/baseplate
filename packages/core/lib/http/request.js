const {InvalidRequestBodyError} = require('../errors')

class Request {
  constructor({body, headers, method, params, url}) {
    this.headers = Object.entries(headers).reduce(
      (headers, [key, value]) => ({
        ...headers,
        [key.toLowerCase()]: value
      }),
      {}
    )
    this.method = method.toLowerCase()
    this.params = params
    this.url = url

    let parsedBody = body

    if (this.headers['content-type'] === 'application/json') {
      try {
        parsedBody = JSON.parse(body)
      } catch (error) {
        throw new InvalidRequestBodyError({
          expectedType: headers['content-type']
        })
      }
    }

    this.body = parsedBody
  }
}

module.exports = Request
