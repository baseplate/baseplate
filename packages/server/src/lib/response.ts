import HttpResponse from '@baseplate/core/dist/lib/http/response'
import {ServerResponse as NodeServerResponse} from 'http'

export default class ServerResponse extends HttpResponse {
  httpResponse: NodeServerResponse

  constructor(httpResponse: NodeServerResponse) {
    super()

    this.httpResponse = httpResponse
  }

  end() {
    return this.send()
  }

  send(body?: string) {
    if (this.contentType) {
      this.httpResponse.setHeader('content-type', this.contentType)
    }

    this.httpResponse.writeHead(this.statusCode)
    this.httpResponse.end(body)
  }

  setHeader(name: string, value: string) {
    this.httpResponse.setHeader(name, value)
  }
}
