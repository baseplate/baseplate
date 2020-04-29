const RouteRecognizer = require('route-recognizer')

const createDatastore = require('../lib/datastore/factory')
const endpointStore = require('../lib/endpointStore')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const modelFactory = require('../lib/modelFactory')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')
const patchContext = require('../lib/utils/patchContext')
const requestResponseFactory = require('../lib/requestResponse/factory')
const schemaStore = require('../lib/schemaStore')

const router = new RouteRecognizer()

endpointStore.endpoints.forEach(({handler, route}) => {
  router.add([{path: route, handler}])
})

router.add([{path: '/:modelName', handler: require('./rest/entries')}])
router.add([{path: '/:modelName/:id', handler: require('./rest/entry')}])
router.add([
  {
    path: '/:modelName/:id/:fieldName',
    handler: require('./rest/entryField')
  }
])
router.add([
  {
    path: '/:modelName/:id/relationships/:fieldName',
    handler: require('./rest/entryFieldRelationship')
  }
])

schemaStore.getExtendedSchemas().forEach(schema => {
  const Model = modelFactory(schema)

  Object.entries(Model.routes).forEach(([path, handler]) => {
    const boundHandlers = Object.keys(handler).reduce((boundHandlers, verb) => {
      return {
        ...boundHandlers,
        [verb]: handler[verb].bind(Model)
      }
    }, {})

    router.add([
      {path: `/${Model.schema.plural}${path}`, handler: boundHandlers}
    ])
  })
})

module.exports.handler = (event, context, callback) => {
  patchContext(context)

  const method = event.httpMethod.toLowerCase()
  const routes = router.recognize(event.path) || []
  const match = Array.from(routes).find(route => {
    return typeof route.handler[method] === 'function'
  })

  if (match) {
    const patchedEvent = {
      ...event,
      pathParameters: match.params
    }
    const authTokenData = parseAuthorizationHeader(event.headers.Authorization)
    const requestContext = {
      datastore: createDatastore(),
      user: getUserFromToken(authTokenData)
    }

    return requestResponseFactory(match.handler[method])({
      callback,
      context: requestContext,
      event: patchedEvent
    })
  }

  callback(null, {
    statusCode: 404,
    body: ''
  })
}
