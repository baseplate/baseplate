import {threadId} from 'worker_threads'

export default abstract class HttpResponse {
  contentType: string
  headers: Record<string, string>
  statusCode: number

  constructor() {
    this.headers = {}
    this.statusCode = 200
  }

  abstract end(): void

  json(data: object, contentType = 'application/json'): void {
    const body = JSON.stringify(data)

    this.contentType = contentType

    return this.send(body)
  }

  abstract send(body: any): void

  setHeader(name: string, value: string) {
    this.headers[name] = value
  }

  status(statusCode: number): HttpResponse {
    this.statusCode = statusCode

    return this
  }
}
