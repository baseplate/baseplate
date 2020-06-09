import * as path from 'path'

const requireDirectory = require('../lib/utils/requireDirectory')

const ENDPOINTS_PATH = path.join(process.cwd(), 'endpoints')

type Endpoint = {
  route: string
  handler: Function
}

class EndpointStore {
  endpoints: Array<Endpoint>

  constructor(directory: string) {
    this.endpoints = EndpointStore.buildFromDirectory(directory)
  }

  static buildFromDirectory(directory: string): Array<Endpoint> {
    const files = requireDirectory(directory)
    const routes = files.reduce(
      (routes: string, {name, source}: {name: string; source: Endpoint}) => {
        const route =
          typeof source.route === 'string'
            ? this.normalizeRoute(source.route)
            : `/${name}`

        return [
          ...routes,
          {
            route,
            handler: source
          }
        ]
      },
      []
    )

    return routes
  }

  static normalizeRoute(route: string): string {
    return route.startsWith('/') ? route : `/${route}`
  }
}

export const instance = new EndpointStore(ENDPOINTS_PATH)
