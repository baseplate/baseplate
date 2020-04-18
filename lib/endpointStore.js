const fs = require('fs')
const path = require('path')

const ENDPOINTS_PATH = path.join(process.cwd(), 'endpoints')

class EndpointStore {
  constructor(directory) {
    this.endpoints = this.constructor.buildFromDirectory(directory)
  }

  static buildFromDirectory(directory) {
    const fileNames = fs.readdirSync(directory)
    const routes = fileNames.reduce((result, fileName) => {
      if (path.extname(fileName) !== '.js') {
        return result
      }

      const baseName = path.basename(fileName, '.js')
      const sourcePath = path.join(directory, fileName)
      const source = require(sourcePath)
      const route =
        typeof source.route === 'string'
          ? this.normalizeRoute(source.route)
          : baseName

      return [
        ...result,
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
