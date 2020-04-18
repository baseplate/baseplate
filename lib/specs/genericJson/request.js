const {InvalidRequestBodyError} = require('../../errors')

class GenericJsonRequest {
  constructor({body, url}) {
    this.body = body
    this.url = url
  }

  getBody() {
    try {
      return JSON.parse(this.body)
    } catch (error) {
      throw new InvalidRequestBodyError({expectedType: 'application/json'})
    }
  }
}

module.exports = GenericJsonRequest
