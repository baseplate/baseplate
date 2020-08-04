import {HttpRequest, HttpResponse} from '../../packages/core/src'
import {URL} from 'url'

export interface RequestOptions {
  accessToken?: string
  body?: object | string
  contentType?: 'json' | 'jsonApi'
  method?: string
  refreshToken?: string
  url: string
}

export class Request extends HttpRequest {
  constructor({
    accessToken,
    body,
    contentType = 'json',
    method = 'get',
    refreshToken,
    url,
  }: RequestOptions) {
    const headers: HttpRequest['headers'] = {}

    if (accessToken) {
      headers['authorization'] = `Bearer ${accessToken}`
    }

    if (contentType === 'json') {
      headers['content-type'] = 'application/json'
    } else if (contentType === 'jsonApi') {
      headers['content-type'] = 'application/vnd.api+json'
    }

    if (refreshToken) {
      headers.Cookie = `refresh_token=${refreshToken}`
    }

    const stringBody = typeof body === 'string' ? body : JSON.stringify(body)
    const urlObject = new URL(`https://example.com${url}`)

    super({
      body: stringBody,
      headers,
      method,
      url: urlObject,
    })
  }
}

export class Response extends HttpResponse {
  $body: any

  end() {
    return this
  }

  send(body: string) {
    this.$body =
      this.contentType === 'application/json' ||
      this.contentType === 'application/vnd.api+json'
        ? JSON.parse(body)
        : body

    return this.end()
  }
}
