const path = require('path')

const requireDirectory = require('../lib/utils/requireDirectory')

const ENDPOINTS_PATH = path.join(process.cwd(), 'endpoints')

class EndpointStore {
  constructor(directory) {
    this.endpoints = this.constructor.buildFromDirectory(directory)
  }

  static buildFromDirectory(directory) {
    const files = requireDirectory(directory)
    const routes = files.reduce((routes, {name, source}) => {
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
    }, [])

    return routes
  }

  static normalizeRoute(route) {
    return route.startsWith('/') ? route : `/${route}`
  }
}

module.exports = new EndpointStore(ENDPOINTS_PATH)
