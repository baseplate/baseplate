import {URL} from 'url'

import {InvalidRequestBodyError} from '../errors'

export type HeadersMap = {
  [key: string]: string
}

export type ParamsMap = {
  [key: string]: string
}

type HttpRequestParameters = {
  body: string
  headers: HeadersMap
  method: string
  params?: ParamsMap
  url: URL
}

export default class HttpRequest {
  public body: any
  public headers: HeadersMap
  public method: string
  public params: ParamsMap
  public url: URL

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
