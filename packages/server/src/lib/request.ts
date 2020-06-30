import HttpRequest from '../../../core/src/lib/http/request'
import {IncomingMessage} from 'http'
import {URL} from 'url'

export default class ServerRequest extends HttpRequest {
  constructor(req: IncomingMessage, body: string) {
    const url = new URL(req.url, `http://${req.headers.host}`)

    super({
      body,
      headers: <Record<string, string>>req.headers,
      method: req.method,
      url,
    })
  }
}
