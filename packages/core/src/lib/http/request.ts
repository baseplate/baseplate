const {InvalidRequestBodyError} = require('../errors')

type HeadersMap = {
  [key: string]: string
}

type ParamsMap = {
  [key: string]: string
}

type HttpRequestParameters = {
  body: string
  headers: HeadersMap
  method: string
  params: ParamsMap
  url: string
}

export class HttpRequest {
  body: object | string
  headers: HeadersMap
  method: string
  params: ParamsMap
  url: string

  constructor({body, headers, method, params, url}: HttpRequestParameters) {
    this.headers = Object.entries(headers).reduce(
      (headers, [key, value]) => ({
        ...headers,
        [key.toLowerCase()]: value,
      }),
      {}
    )
    this.method = method.toLowerCase()
    this.params = params
    this.url = url

    let parsedBody = body

    if (body && this.headers['content-type'] === 'application/json') {
      try {
        parsedBody = JSON.parse(body)
      } catch (error) {
        throw new InvalidRequestBodyError({
          expectedType: headers['content-type'],
        })
      }
    }

    this.body = parsedBody
  }
}
