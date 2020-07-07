import RouteRecognizer from 'route-recognizer'

import {instance as endpointStore} from '../lib/endpointStore'
import Context from '../lib/context'
import getUserFromToken from '../lib/acl/getUserFromToken'
import HttpRequest, {ParamsMap as HttpParams} from '../lib/http/request'
import HttpResponse from '../lib/http/response'
import parseAuthorizationHeader from '../lib/acl/parseAuthorizationHeader'
import modelStore from '../lib/modelStore'

const router = new RouteRecognizer()

type HttpVerb = 'delete' | 'get' | 'options' | 'patch' | 'post' | 'put'
type RouteParameters = Record<string, string>

router.add([
  {
    path: '/:modelName',
    handler: (method: HttpVerb, params: RouteParameters) => {
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        Model &&
        method === 'get' &&
        Model.base$settings.interfaces.jsonApiFetchResources
      ) {
        return require('../lib/specs/jsonApi/controllers/findResources').default
      }

      if (
        Model &&
        method === 'post' &&
        Model.base$settings.interfaces.jsonApiCreateResource
      ) {
        return require('../lib/specs/jsonApi/controllers/createResource')
          .default
      }
    },
  },
])
router.add([
  {
    path: '/:modelName/:id',
    handler: (method: HttpVerb, params: RouteParameters) => {
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        Model &&
        method === 'delete' &&
        Model.base$settings.interfaces.jsonApiDeleteResource
      ) {
        return require('../lib/specs/jsonApi/controllers/deleteResource')
          .default
      }

      if (
        Model &&
        method === 'get' &&
        Model.base$settings.interfaces.jsonApiFetchResource
      ) {
        return require('../lib/specs/jsonApi/controllers/findResource').default
      }

      if (
        Model &&
        method === 'patch' &&
        Model.base$settings.interfaces.jsonApiUpdateResource
      ) {
        return require('../lib/specs/jsonApi/controllers/updateResource')
          .default
      }
    },
  },
])
router.add([
  {
    path: '/:modelName/:id/:fieldName',
    handler: (method: HttpVerb, params: RouteParameters) => {
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        Model &&
        method === 'get' &&
        Model.base$settings.interfaces.jsonApiFetchResourceField
      ) {
        return require('../lib/specs/jsonApi/controllers/findResourceField')
          .default
      }
    },
  },
])
router.add([
  {
    path: '/:modelName/:id/relationships/:fieldName',
    handler: (method: HttpVerb, params: RouteParameters) => {
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        method === 'get' &&
        Model.base$settings.interfaces.jsonApiFetchResourceFieldRelationship
      ) {
        return require('../lib/specs/jsonApi/controllers/findResourceFieldRelationship')
          .default
      }
    },
  },
])

export function handler(req: HttpRequest, res: HttpResponse) {
  const authTokenData = parseAuthorizationHeader(req.headers.authorization)
  const context = new Context({
    base$user: getUserFromToken(authTokenData),
  })
  const routes = router.recognize(req.url.pathname)

  if (!routes) {
    res.status(404).end()
  }

  const hasMatch = Array.from(routes).some((route) => {
    const handler = (<Function>route.handler)(req.method, route.params, context)

    if (!handler) {
      return false
    }

    req.params = <HttpParams>route.params

    handler(req, res, context)

    return true
  })

  if (!hasMatch) {
    res.status(404).end()
  }
}

export function initialize() {
  endpointStore.endpoints.forEach((endpoint) => {
    const {handler, route} = endpoint

    router.add([
      {
        path: <any>route,
        handler: (method: HttpVerb) => {
          if (typeof handler[method] === 'function') {
            return handler[method]
          }
        },
      },
    ])
  })

  modelStore.getAll().forEach((Model) => {
    const routes = Model.base$routes || {}

    Object.entries(routes).forEach(([path, customRoute]) => {
      router.add([
        {
          path,
          handler: (method: string) => {
            if (typeof customRoute[method] !== 'function') {
              return
            }

            return customRoute[method].bind(Model)
          },
        },
      ])
    })
  })
}
