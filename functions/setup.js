const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../lib/errors')
const createDatastore = require('../lib/datastore/factory')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const JsonApiResponse = require('../lib/specs/jsonApi/response')
const modelStore = require('../lib/modelStore')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')
const patchContext = require('../lib/utils/patchContext')
const requestResponseFactory = require('../lib/requestResponse/factory')
const userInternalSchema = require('../lib/internalSchemas/user')

modelStore.add(userInternalSchema, {loadFieldHandlers: true})

async function setupController(req, res, context) {
  try {
    if (!context.user || !context.user.isAdmin()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const modelNames =
      req.url.getQueryParameter('models', {
        isCSV: true
      }) || []
    const models = modelNames.map(modelName => {
      const Model = modelStore.get(modelName, {context})

      if (!Model) {
        throw new ModelNotFoundError({name: modelName})
      }

      return Model
    })
    const result = await Promise.all(
      models.map(Model => {
        return typeof Model.setup === 'function' ? Model.setup() : null
      })
    )

    res.status(200).json({data: result})
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}

module.exports.handler = (event, context, callback) => {
  patchContext(context)

  const authTokenData = parseAuthorizationHeader(event.headers.Authorization)
  const requestContext = {
    datastore: createDatastore(),
    user: getUserFromToken(authTokenData, modelStore)
  }

  requestResponseFactory(setupController)({
    callback,
    context: requestContext,
    event
  })
}
