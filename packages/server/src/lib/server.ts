import {ListenOptions} from 'net'
import http from 'http'

import cors from './cors'
import ServerRequest from './request'
import ServerResponse from './response'

interface App {
  routesGraphQL: CoreHandler
  routesRest: CoreHandler
}

type Handler = Function

type CoreHandler = {handler: Handler; initialize?: Function}

interface StartServerParameters {
  host: string
  port: number
}

export default class Server {
  app: App
  handlers: Array<Handler>
  httpServer: http.Server

  constructor() {
    this.handlers = []
    this.httpServer = this.createServer()

    this.use(cors)
  }

  attach(app: App) {
    if (app.routesGraphQL.initialize) {
      app.routesGraphQL.initialize()
    }

    if (app.routesRest.initialize) {
      app.routesRest.initialize()
    }

    this.use((req: ServerRequest, res: ServerResponse) => {
      if (req.method === 'post' && req.url.pathname === '/graphql') {
        return app.routesGraphQL.handler(req, res)
      }

      return app.routesRest.handler(req, res)
    })

    this.app = app

    return this
  }

  createServer() {
    return http.createServer((rawRequest, rawResponse) => {
      let body = ''

      rawRequest.on('data', (chunk) => {
        body += chunk.toString()
      })

      rawRequest.on('end', () => {
        const request = new ServerRequest(rawRequest, body)
        const response = new ServerResponse(rawResponse)

        return this.getNextHandler(request, response)
      })
    })
  }

  getNextHandler(req: ServerRequest, res: ServerResponse, index = 0) {
    const handler =
      this.handlers[index] ||
      ((req: ServerRequest, res: ServerResponse) => res.status(404).end())

    return handler(
      req,
      res,
      this.getNextHandler.bind(this, req, res, index + 1)
    )
  }

  start({host, port}: StartServerParameters) {
    if (!this.app) {
      throw new Error('No app attached. Have you called `.attach()`?')
    }

    const serverOptions: ListenOptions = {
      host,
      port,
    }

    return new Promise((resolve, reject) => {
      this.httpServer.listen(serverOptions, () => {
        console.log(
          `[ @baseplate/server ] Server running at http://${host}:${port}`
        )

        resolve()
      })
    })
  }

  use(handler: Handler) {
    this.handlers.push(handler)

    return this
  }
}
