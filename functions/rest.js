const RouteRecognizer = require('route-recognizer')

const createDatastore = require('../lib/datastore/factory')
const endpointStore = require('../lib/endpointStore')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')
const patchContext = require('../lib/utils/patchContext')
const requestResponseFactory = require('../lib/requestResponse/factory')
const modelStore = require('../lib/modelStore/')

const router = new RouteRecognizer()

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
      const Model = modelStore.get(params.modelName, {isPlural: true})

      if (Model && method === 'get' && !Model.disableFindResourcesEndpoint) {
        return require('../lib/specs/jsonApi/controllers/findResources')
      }

      if (Model && method === 'post' && !Model.disableCreateResourceEndpoint) {
        return require('../lib/specs/jsonApi/controllers/createResource')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id',
    handler: (method, params) => {
      const Model = modelStore.get(params.modelName, {isPlural: true})

      if (
        Model &&
        method === 'delete' &&
        !Model.disableDeleteResourceEndpoint
      ) {
        return require('../lib/specs/jsonApi/controllers/deleteResource')
      }

      if (Model && method === 'get' && !Model.disableFindResourceEndpoint) {
        return require('../lib/specs/jsonApi/controllers/findResource')
      }

      if (Model && method === 'patch' && !Model.disableUpdateResourceEndpoint) {
        return require('../lib/specs/jsonApi/controllers/updateResource')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id/:fieldName',
    handler: (method, params) => {
      const Model = modelStore.get(params.modelName, {isPlural: true})

      if (
        Model &&
        method === 'get' &&
        !Model.disableFindResourceFieldEndpoint
      ) {
        return require('../lib/specs/jsonApi/controllers/findResourceField')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id/relationships/:fieldName',
    handler: (method, params) => {
      const Model = modelStore.get(params.modelName, {isPlural: true})

      if (
        method === 'get' &&
        !Model.disableFindResourceFieldRelationshipEndpoint
      ) {
        return require('../lib/specs/jsonApi/controllers/findResourceFieldRelationship')
      }
    }
  }
])

modelStore.models.forEach(Model => {
  Object.entries(Model.customRoutes || {}).forEach(([path, customRoute]) => {
    router.add([
      {
        path,
        handler: (method, _, context) => {
          if (typeof customRoute[method] !== 'function') {
            return
          }

          const ConnectedModel = modelStore.connect(Model, context)

          return customRoute[method].bind(ConnectedModel)
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
    user: getUserFromToken(authTokenData, modelStore)
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
