const RouteRecognizer = require('route-recognizer')

const createDatastore = require('../lib/datastore/factory')
const endpointStore = require('../lib/endpointStore')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')
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
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        Model &&
        method === 'get' &&
        Model.settings.interfaces.jsonApiFetchResources
      ) {
        return require('../lib/specs/jsonApi/controllers/findResources')
      }

      if (
        Model &&
        method === 'post' &&
        Model.settings.interfaces.jsonApiCreateResource
      ) {
        return require('../lib/specs/jsonApi/controllers/createResource')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id',
    handler: (method, params) => {
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        Model &&
        method === 'delete' &&
        Model.settings.interfaces.jsonApiDeleteResource
      ) {
        return require('../lib/specs/jsonApi/controllers/deleteResource')
      }

      if (
        Model &&
        method === 'get' &&
        Model.settings.interfaces.jsonApiFetchResource
      ) {
        return require('../lib/specs/jsonApi/controllers/findResource')
      }

      if (
        Model &&
        method === 'patch' &&
        Model.settings.interfaces.jsonApiUpdateResource
      ) {
        return require('../lib/specs/jsonApi/controllers/updateResource')
      }
    }
  }
])
router.add([
  {
    path: '/:modelName/:id/:fieldName',
    handler: (method, params) => {
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        Model &&
        method === 'get' &&
        Model.settings.interfaces.jsonApiFetchResourceField
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
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        method === 'get' &&
        Model.settings.interfaces.jsonApiFetchResourceFieldRelationship
      ) {
        return require('../lib/specs/jsonApi/controllers/findResourceFieldRelationship')
      }
    }
  }
])

modelStore.sources.forEach(source => {
  const customRoutes =
    (source.modelClass && source.modelClass.customRoutes) || {}

  Object.entries(customRoutes).forEach(([path, customRoute]) => {
    router.add([
      {
        path,
        handler: (method, _, context) => {
          if (typeof customRoute[method] !== 'function') {
            return
          }

          const Model = modelStore.get(source.name, context)

          return customRoute[method].bind(Model)
        }
      }
    ])
  })
})

module.exports = (req, res) => {
  const authTokenData = parseAuthorizationHeader(req.headers.authorization)
  const requestContext = {
    datastore: createDatastore(),
    user: getUserFromToken(authTokenData, modelStore)
  }
  const routes = router.recognize(req.url.pathname) || []
  const hasMatch = Array.from(routes).some(route => {
    const handler = route.handler(req.method, route.params, requestContext)

    if (!handler) {
      return false
    }

    req.params = route.params

    handler(req, res, requestContext)

    return true
  })

  if (!hasMatch) {
    res.status(404).send()
  }
}
