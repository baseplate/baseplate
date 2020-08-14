import {match, MatchFunction, parse} from 'path-to-regexp'
import logger from '../lib/logger'
import {Method} from '../lib/http/request'

interface Route {
  handler: Function
  matcher: MatchFunction<object>
  method: Method
  parameters: object
  rank: number
}

interface RouteMatch {
  handler: Function
  parameters?: object
}

export default class Router {
  private routes: Route[]

  constructor() {
    this.routes = []
  }

  private getRank(pathName: string) {
    const dynamicTokens = parse(pathName).filter(
      (token) => typeof token === 'string'
    )

    return dynamicTokens.length
  }

  add(
    method: Method,
    pathName: string,
    handler: Function,
    parameters: object = {}
  ) {
    logger.debug('Adding %s route: %s', method, pathName)

    const matcher = match(pathName, {decode: decodeURIComponent})
    const rank = this.getRank(pathName)
    const index = this.routes.findIndex((route) => route.rank <= rank)

    this.routes.splice(index, 0, {
      handler,
      matcher,
      method,
      parameters,
      rank,
    })
  }

  delete(pathName: string, handler: Function, parameters?: object) {
    return this.add(Method.delete, pathName, handler, parameters)
  }

  get(pathName: string, handler: Function, parameters?: object) {
    return this.add(Method.get, pathName, handler, parameters)
  }

  match(method: Method, pathName: string): RouteMatch {
    for (const route of this.routes) {
      if (route.method !== method) {
        continue
      }

      const match = route.matcher(pathName)

      if (match) {
        return {
          handler: route.handler,
          parameters: {
            ...match.params,
            ...route.parameters,
          },
        }
      }
    }

    return null
  }

  options(pathName: string, handler: Function, parameters?: object) {
    return this.add(Method.options, pathName, handler, parameters)
  }

  patch(pathName: string, handler: Function, parameters?: object) {
    return this.add(Method.patch, pathName, handler, parameters)
  }

  put(pathName: string, handler: Function, parameters?: object) {
    return this.add(Method.put, pathName, handler, parameters)
  }

  post(pathName: string, handler: Function, parameters?: object) {
    return this.add(Method.post, pathName, handler, parameters)
  }

  reset() {
    this.routes = []
  }
}
