import logger from './logger'

export interface Endpoint {
  route: string
  handler: Record<string, Function>
}

export type EndpointDefinition = Record<string, string | Function>

export class EndpointStore {
  endpoints: Array<Endpoint>

  constructor() {
    this.endpoints = []
  }

  private loadEndpoint(source: EndpointDefinition) {
    if (!source.route || typeof source.route !== 'string') {
      return
    }

    logger.debug('Loading endpoint: %s', source.route)

    const methods: Record<string, Function> = Object.keys(source).reduce(
      (methods, key) => {
        if (typeof source[key] === 'function') {
          return {
            ...methods,
            [key]: source[key],
          }
        }

        return methods
      },
      {}
    )

    this.endpoints.push({
      route: source.route,
      handler: methods,
    })
  }

  load(sources: EndpointDefinition[]) {
    sources.forEach((source) => this.loadEndpoint(source))
  }

  static normalizeRoute(route: string): string {
    return route.startsWith('/') ? route : `/${route}`
  }
}

export default new EndpointStore()
