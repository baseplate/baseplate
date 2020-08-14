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
      if (Model.base$interfacePaths.restCreateResource) {
        router.post(
          Model.base$interfacePaths.restCreateResource,
          JsonApiCreateResource.bind(Model),
          {modelName: Model.base$handle}
        )
      }

      if (Model.base$interfacePaths.restDeleteResource) {
        router.delete(
          Model.base$interfacePaths.restDeleteResource,
          JsonApiDeleteResource.bind(Model),
          {modelName: Model.base$handle}
        )
      }

      if (Model.base$interfacePaths.restFindResource) {
        router.get(
          Model.base$interfacePaths.restFindResource,
          JsonApiFindResource.bind(Model),
          {modelName: Model.base$handle}
        )
      }

      if (Model.base$interfacePaths.restFindResourceField) {
        router.get(
          Model.base$interfacePaths.restFindResourceField,
          JsonApiFindResourceField.bind(Model),
          {modelName: Model.base$handle}
        )
      }

      if (Model.base$interfacePaths.restFindResourceFieldRelationship) {
        router.get(
          Model.base$interfacePaths.restFindResourceFieldRelationship,
          JsonApiFindResourceFieldRelationship.bind(Model),
          {modelName: Model.base$handle}
        )
      }

      if (Model.base$interfacePaths.restFindResources) {
        router.get(
          Model.base$interfacePaths.restFindResources,
          JsonApiFindResources.bind(Model),
          {modelName: Model.base$handle}
        )
      }

      if (Model.base$interfacePaths.restUpdateResource) {
        router.patch(
          Model.base$interfacePaths.restUpdateResource,
          JsonApiUpdateResource.bind(Model),
          {modelName: Model.base$handle}
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
