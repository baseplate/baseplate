import {Method as HttpMethod} from './http/request'
import logger from './logger'
import normalizeRoute from './utils/normalizeRoute'

export interface Endpoint {
  route: string
  handler: Record<HttpMethod, Function>
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
      route: normalizeRoute(source.route),
      handler: methods,
    })
  }

  load(sources: EndpointDefinition[]) {
    sources.forEach((source) => this.loadEndpoint(source))
  }
}

export default new EndpointStore()
