import Context from '../lib/context'
import endpointStore from '../lib/endpointStore'
import {EntryNotFoundError} from '../lib/errors'
import type EntryPoint from '../lib/entryPoint'
import getUserFromToken from '../lib/acl/getUserFromToken'
import HttpRequest, {
  Method as HttpMethod,
  ParamsMap as HttpParams,
} from '../lib/http/request'
import HttpResponse from '../lib/http/response'
import JsonApiCreateResource from '../lib/specs/jsonApi/controllers/createResource'
import JsonApiDeleteResource from '../lib/specs/jsonApi/controllers/deleteResource'
import JsonApiFindResource from '../lib/specs/jsonApi/controllers/findResource'
import JsonApiFindResourceField from '../lib/specs/jsonApi/controllers/findResourceField'
import JsonApiFindResourceFieldRelationship from '../lib/specs/jsonApi/controllers/findResourceFieldRelationship'
import JsonApiFindResources from '../lib/specs/jsonApi/controllers/findResources'
import JsonApiResponse from '../lib/specs/jsonApi/response'
import JsonApiUpdateResource from '../lib/specs/jsonApi/controllers/updateResource'
import JsonApiURL from '../lib/specs/jsonApi/url'
import parseAuthorizationHeader from '../lib/acl/parseAuthorizationHeader'
import modelStore from '../lib/modelStore'
import Router from '../lib/router'

type RouteParameters = Record<string, string>

const router = new Router()

const restEntryPoint: EntryPoint = {
  async handler(req: HttpRequest, res: HttpResponse) {
    const authTokenData = parseAuthorizationHeader(req.headers.authorization)
    const context = new Context({
      base$user: getUserFromToken(authTokenData),
    })
    const route = router.match(req.method, req.url.pathname)

    if (!route) {
      const jsonApiRes = new JsonApiResponse({
        errors: [new EntryNotFoundError()],
        res,
        url: new JsonApiURL(req.url),
      })

      return jsonApiRes.end()
    }

    req.params = <HttpParams>route.parameters

    return route.handler(req, res, context)
  },

  initialize() {
    router.reset()

    endpointStore.endpoints.forEach((endpoint) => {
      for (const method in endpoint.handler) {
        const handler = endpoint.handler[method as HttpMethod]

        if (typeof handler === 'function' && method in HttpMethod) {
          router.add(<HttpMethod>method, endpoint.route, handler)
        }
      }
    })

    modelStore.getAll().forEach((Model) => {
      if (typeof Model.base$interfaces.restCreateResource === 'string') {
        router.post(
          Model.base$interfaces.restCreateResource,
          JsonApiCreateResource.bind(Model)
        )
      }

      if (typeof Model.base$interfaces.restDeleteResource === 'string') {
        router.delete(
          Model.base$interfaces.restDeleteResource,
          JsonApiDeleteResource.bind(Model)
        )
      }

      if (typeof Model.base$interfaces.restFindResource === 'string') {
        router.get(
          Model.base$interfaces.restFindResource,
          JsonApiFindResource.bind(Model)
        )
      }

      if (typeof Model.base$interfaces.restFindResourceField === 'string') {
        router.get(
          Model.base$interfaces.restFindResourceField,
          JsonApiFindResourceField.bind(Model)
        )
      }

      if (
        typeof Model.base$interfaces.restFindResourceFieldRelationship ===
        'string'
      ) {
        router.get(
          Model.base$interfaces.restFindResourceFieldRelationship,
          JsonApiFindResourceFieldRelationship.bind(Model)
        )
      }

      if (typeof Model.base$interfaces.restFindResources === 'string') {
        router.get(
          Model.base$interfaces.restFindResources,
          JsonApiFindResources.bind(Model)
        )
      }

      if (typeof Model.base$interfaces.restUpdateResource === 'string') {
        router.patch(
          Model.base$interfaces.restUpdateResource,
          JsonApiUpdateResource.bind(Model)
        )
      }

      const customRoutes = Model.base$routes || {}

      for (const path in customRoutes) {
        const route = customRoutes[path]

        for (const method in route) {
          if (method in HttpMethod && typeof route[method] === 'function') {
            router.add(<HttpMethod>method, path, route[method].bind(Model))
          }
        }
      }
    })
  },
}

export default restEntryPoint
