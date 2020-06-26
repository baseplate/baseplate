import * as path from 'path'

import requireDirectory from '../lib/utils/requireDirectory'

const ENDPOINTS_PATH = path.join(process.cwd(), 'endpoints')

interface Endpoint {
  route: string
  handler: Record<string, Function>
}

interface EndpointFile {
  name: string
  source: any
}

class EndpointStore {
  endpoints: Array<Endpoint>

  constructor(directory: string) {
    this.endpoints = EndpointStore.buildFromDirectory(directory)
  }

  static buildFromDirectory(directory: string): Array<Endpoint> {
    const files = requireDirectory(directory)
    const routes = files.reduce(
      (routes: Array<Endpoint>, {name, source}: EndpointFile) => {
        const route =
          typeof source.route === 'string'
            ? this.normalizeRoute(source.route)
            : `/${name}`

        return [
          ...routes,
          {
            route,
            handler: source,
          },
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
