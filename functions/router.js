const RouteRecognizer = require('route-recognizer')

const endpointStore = require('../lib/endpointStore')
const ModelStore = require('../lib/modelStore')
const patchContext = require('../lib/utils/patchContext')
const requestResponseFactory = require('../lib/requestResponse/factory')

const modelStore = new ModelStore()
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

modelStore.getAll({includeBaseUserModel: true}).forEach(Model => {
  if (typeof Model.getRoutes === 'function') {
    const routes = Model.getRoutes()

    Object.entries(routes).forEach(([path, handler]) => {
      router.add([{path: `/${Model.name}${path}`, handler}])
    })
  }
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

    return requestResponseFactory(match.handler[method])({
      callback,
      context,
      event: patchedEvent,
      modelStore
    })
  }

  callback(null, {
    statusCode: 404,
    body: ''
  })
}
