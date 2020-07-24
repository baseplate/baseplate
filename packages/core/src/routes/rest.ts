import Context from '../lib/context'
import endpointStore from '../lib/endpointStore'
import type EntryPoint from '../lib/entryPoint'
import getUserFromToken from '../lib/acl/getUserFromToken'
import HttpRequest, {ParamsMap as HttpParams} from '../lib/http/request'
import HttpResponse from '../lib/http/response'
import JsonApiCreateResource from '../lib/specs/jsonApi/controllers/createResource'
import JsonApiDeleteResource from '../lib/specs/jsonApi/controllers/deleteResource'
import JsonApiFindResource from '../lib/specs/jsonApi/controllers/findResource'
import JsonApiFindResourceField from '../lib/specs/jsonApi/controllers/findResourceField'
import JsonApiFindResourceFieldRelationship from '../lib/specs/jsonApi/controllers/findResourceFieldRelationship'
import JsonApiFindResources from '../lib/specs/jsonApi/controllers/findResources'
import JsonApiUpdateResource from '../lib/specs/jsonApi/controllers/updateResource'
import parseAuthorizationHeader from '../lib/acl/parseAuthorizationHeader'
import modelStore from '../lib/modelStore'
import Router from '../lib/router'

type HttpVerb = 'delete' | 'get' | 'options' | 'patch' | 'post' | 'put'
type RouteParameters = Record<string, string>

const router = new Router()

const restEntryPoint: EntryPoint = {
  async handler(req: HttpRequest, res: HttpResponse) {
    const authTokenData = parseAuthorizationHeader(req.headers.authorization)
    const context = new Context({
      base$user: getUserFromToken(authTokenData),
    })
    const route = router.match(req.url.pathname)

    if (!route) {
      return res.status(404).end()
    }

    const handler = (<Function>route.handler)(
      req.method,
      route.parameters,
      context
    )

    if (handler) {
      req.params = <HttpParams>route.parameters

      return handler(req, res, context)
    }

    return res.status(404).end()
  },

  initialize() {
    router.reset()

    router.add('/:modelName', (method: HttpVerb, params: RouteParameters) => {
      const Model = modelStore.getByPluralForm(params.modelName)

      if (
        Model &&
        method === 'get' &&
        Model.base$interfaces.restFindResources
      ) {
        return JsonApiFindResources
      }

      if (
        Model &&
        method === 'post' &&
        Model.base$interfaces.restCreateResource
      ) {
        return JsonApiCreateResource
      }
    })

    router.add(
      '/:modelName/:id',
      (method: HttpVerb, params: RouteParameters) => {
        const Model = modelStore.getByPluralForm(params.modelName)

        if (
          Model &&
          method === 'delete' &&
          Model.base$interfaces.restDeleteResource
        ) {
          return JsonApiDeleteResource
        }

        if (
          Model &&
          method === 'get' &&
          Model.base$interfaces.restFindResource
        ) {
          return JsonApiFindResource
        }

        if (
          Model &&
          method === 'patch' &&
          Model.base$interfaces.restUpdateResource
        ) {
          return JsonApiUpdateResource
        }
      }
    )

    router.add(
      '/:modelName/:id/:fieldName',
      (method: HttpVerb, params: RouteParameters) => {
        const Model = modelStore.getByPluralForm(params.modelName)

        if (
          Model &&
          method === 'get' &&
          Model.base$interfaces.restFindResourceField
        ) {
          return JsonApiFindResourceField
        }
      }
    )

    router.add(
      '/:modelName/:id/relationships/:fieldName',
      (method: HttpVerb, params: RouteParameters) => {
        const Model = modelStore.getByPluralForm(params.modelName)

        if (
          method === 'get' &&
          Model.base$interfaces.restFindResourceFieldRelationship
        ) {
          return JsonApiFindResourceFieldRelationship
        }
      }
    )

    endpointStore.endpoints.forEach((endpoint) => {
      const {handler, route} = endpoint

      router.add(route, (method: HttpVerb) => {
        if (typeof handler[method] === 'function') {
          return handler[method]
        }
      })
    })

    modelStore.getAll().forEach((Model) => {
      const routes = Model.base$routes || {}

      Object.entries(routes).forEach(([path, route]) => {
        router.add(path, (method: string) => {
          if (typeof route[method] !== 'function') {
            return
          }

          return route[method].bind(Model)
        })
      })
    })
  },
}

export default restEntryPoint
