import {match, MatchFunction, parse} from 'path-to-regexp'

interface Route {
  handler: Function
  matcher: MatchFunction<object>
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

  add(pathName: string, handler: Function) {
    const matcher = match(pathName, {decode: decodeURIComponent})
    const rank = this.getRank(pathName)
    const index = this.routes.findIndex((route) => route.rank <= rank)

    this.routes.splice(index, 0, {
      handler,
      matcher,
      rank,
    })
  }

  match(pathName: string): RouteMatch {
    for (const route of this.routes) {
      const match = route.matcher(pathName)

      if (match) {
        return {
          handler: route.handler,
          parameters: match.params,
        }
      }
    }

    return null
  }

  reset() {
    this.routes = []
  }
}
