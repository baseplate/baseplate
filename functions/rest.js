const RouteRecognizer = require('route-recognizer')

const createDatastore = require('../lib/datastore/factory')
const endpointStore = require('../lib/endpointStore')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const modelFactory = require('../lib/modelFactory')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')
const patchContext = require('../lib/utils/patchContext')
const requestResponseFactory = require('../lib/requestResponse/factory')
const schemaStore = require('../lib/schemaStore')
const schemaInternalSchema = require('../lib/internalSchemas/schema')
const userInternalSchema = require('../lib/internalSchemas/user')

const router = new RouteRecognizer()

schemaStore.add(schemaInternalSchema)
schemaStore.add(userInternalSchema)

endpointStore.endpoints.forEach(({handler, route}) => {
  router.add([
    {
      path: route,
      handler: method => {
        if (typeof handler[method] === 'function') {
          return handler[method]
        }
      }
    }
  ])
})

router.add([
  {
    path: '/:modelName',
    handler: (method, params) => {
      const schema = schemaStore.get(params.modelName, true)

      if (method === 'get' && !schema.disableFindResourcesEndpoint) {
        return require('../lib/specs/jsonApi/controllers/findResources')
      }

      if (method === 'post' && !schema.disableCreateResourceEndpoint) {
        return require('../lib/specs/jsonApi/controllers/createResource')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id',
    handler: (method, params) => {
      const schema = schemaStore.get(params.modelName, true)

      if (method === 'delete' && !schema.disableDeleteResourceEndpoint) {
        return require('../lib/specs/jsonApi/controllers/deleteResource')
      }

      if (method === 'get' && !schema.disableFindResourceEndpoint) {
        return require('../lib/specs/jsonApi/controllers/findResource')
      }

      if (method === 'update' && !schema.disableUpdateResourceEndpoint) {
        return require('../lib/specs/jsonApi/controllers/updateResource')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id/:fieldName',
    handler: (method, params) => {
      const schema = schemaStore.get(params.modelName, true)

      if (method === 'get' && !schema.disableFindResourceFieldEndpoint) {
        return require('../lib/specs/jsonApi/controllers/findResourceField')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id/relationships/:fieldName',
    handler: (method, params) => {
      const schema = schemaStore.get(params.modelName, true)

      if (
        method === 'get' &&
        !schema.disableFindResourceFieldRelationshipEndpoint
      ) {
        return require('../lib/specs/jsonApi/controllers/findResourceFieldRelationship')
      }
    }
  }
])

schemaStore.models.forEach(source => {
  Object.entries(source.customRoutes || {}).forEach(([path, customRoute]) => {
    router.add([
      {
        path: `/${source.schema.plural}${path}`,
        handler: (method, _, context) => {
          if (typeof customRoute[method] !== 'function') {
            return
          }

          const Model = modelFactory(source, {context})

          return customRoute[method].bind(Model)
        }
      }
    ])
  })
})

module.exports.handler = (event, context, callback) => {
  patchContext(context)

  const method = event.httpMethod.toLowerCase()
  const authTokenData = parseAuthorizationHeader(event.headers.Authorization)
  const requestContext = {
    datastore: createDatastore(),
    user: getUserFromToken(authTokenData)
  }
  const routes = router.recognize(event.path) || []
  const hasMatch = Array.from(routes).some(route => {
    const handler = route.handler(method, route.params, requestContext)

    if (!handler) {
      return false
    }

    const patchedEvent = {
      ...event,
      pathParameters: route.params
    }

    requestResponseFactory(handler)({
      callback,
      context: requestContext,
      event: patchedEvent
    })

    return true
  })

  if (!hasMatch) {
    callback(null, {
      statusCode: 404,
      body: ''
    })
  }
}
