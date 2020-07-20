import {createLogger} from '@baseplate/core'
import {ListenOptions} from 'net'
import http from 'http'
import * as Core from '@baseplate/core'

import cors from './cors'
import ServerRequest from './request'
import ServerResponse from './response'

const logger = createLogger('server')

type Handler = Function

interface StartServerParameters {
  host: string
  port: number
}

export default class Server {
  app: Promise<typeof Core>
  handlers: Array<Handler>
  httpServer: http.Server

  constructor(app: typeof Core) {
    this.handlers = []
    this.httpServer = this.createServer()

    this.use(cors)

    this.app = this.bootstrap(app)
  }

  async bootstrap(app: typeof Core) {
    if (app.routesGraphQL.initialize) {
      app.routesGraphQL.initialize()
    }

    if (app.routesRest.initialize) {
      app.routesRest.initialize()
    }

    await Promise.all(app.modelStore.getAll().map((Model) => Model.base$sync()))

    this.use((req: ServerRequest, res: ServerResponse) => {
      if (req.method === 'post' && req.url.pathname === '/graphql') {
        return app.routesGraphQL.handler(req, res)
      }

      return app.routesRest.handler(req, res)
    })

    return app
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

  async start({host, port}: StartServerParameters) {
    if (!this.app) {
      throw new Error('No app attached. Have you called `.attach()`?')
    }

    const serverOptions: ListenOptions = {
      host,
      port,
    }

    await this.app

    return new Promise((resolve, reject) => {
      this.httpServer.listen(serverOptions, () => {
        logger.info(`Server running at http://${host}:${port}`)

        resolve()
      })
    })
  }

  use(handler: Handler) {
    this.handlers.push(handler)

    return this
  }
}
