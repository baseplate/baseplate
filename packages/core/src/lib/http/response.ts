export abstract class HttpResponse {
  contentType: string
  statusCode: number

  constructor() {
    this.statusCode = 200
  }

  json(data: object): void {
    const body = JSON.stringify(data)

    this.contentType = 'application/json'

    return this.send(body)
  }

  // This is a noop, because this method is meant to be implemented by any
  // class that extends HttpResponse.
  abstract send(body: any): void

  status(statusCode: number): HttpResponse {
    this.statusCode = statusCode

    return this
  }
}
